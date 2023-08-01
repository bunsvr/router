import { Errorlike, GenericServeOptions, Server, ServerWebSocket, TLSOptions, WebSocketHandler } from 'bun';
import { Handler, StaticRoute } from './types';
import Radx from './router';
import { createFetch, createWSHandler } from './createFetch';
import { methodsLowerCase as methods } from './constants';

/**
 * An error handler
 */
export interface ErrorHandler {
    (this: Server, err: Errorlike): any
}

/**
 * A pre-handler 
 */
interface PreHandler extends Handler {
    /**
     * If set to true, the response of this handler will be returned (if the response is not `undefined`)
     */
    response?: boolean;
}

interface Options extends Partial<TLSOptions>, Partial<ServerWebSocket<Request>>, GenericServeOptions {
    serverNames?: Record<string, TLSOptions>;

    /**
     * Enable websockets with {@link Bun.serve}
     * 
     * For simpler type safety, see {@link Bun.websocket}
     */
    websocket?: WebSocketHandler;

    /**
     * An error handler
     * @param this 
     * @param request 
     */
    error?: ErrorHandler;

    /**
     * Fetch handler.
     * @param request Incoming request
     * @param server Current Bun server
     */
    fetch?: Handler;

    /**
     * Enable inspect mode
     */
    inspector?: boolean;

    /**
     * Should be set to something like http://localhost:3000
     * This enables optimizations for path parsing
     */
    base?: string;

    /**
     * Whether to use VM to compile code or the `Function()` constructor
     */
    useVM?: boolean;
}

const serverError = { status: 500 };
const default505 = () => new Response(null, serverError);

export function macro(fn: Handler<string>) {
    const fnStr = fn.toString();
    if (!fnStr.startsWith('()') && !fnStr.startsWith('(r)') && !fnStr.startsWith('(i)') && !fnStr.startsWith('(r, i)'))
        throw new Error('Macros should have no argument, or one argument named `r` for request, or one argument named `i` for the store, or these two: ' + fnStr);

    // @ts-ignore detect by createFetch
    fn.isMacro = true;
    return fn;
}

// Fix missing types
export interface Router extends Options { };

/**
 * A Stric router
 * 
 * Note: This will run *only* the first route found
 */
export class Router<I extends Dict<any> = {}> implements Options {
    /**
     * Internal dynamic path router 
     */
    readonly router: Radx<Handler>;
    readonly static: StaticRoute = {};
    // This value is read by the createFetch() method
    fn404: Handler;
    injects: Record<string, any>;
    fnPre: PreHandler;
    
    /**
     * Create a router
     */
    constructor(opts: Options = {}) {
        Object.assign(this, opts);

        for (const method of methods) {
            const METHOD = method.toUpperCase();
            this[method] = (path: string, handler: Handler) => this.use(METHOD, path, handler);
        }
    }

    // Handle websocket
    private webSocketHandlers: WebSocketHandler[];
    /**
     * Handling WebSocket connections. Only works in Bun
     * 
     * WebSocket pathname cannot collide with any other pathname,
     * and cannot be dynamic.
     * @param path 
     * @param handler 
     */
    ws<T extends string>(path: T, handler: WebSocketHandler<Request<T>>) {
        if (!this.webSocketHandlers)
            this.webSocketHandlers = [];

        // @ts-ignore this is gonna be a nightmare to maintain
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

        if (path.includes(':') || path.includes('*'))
            throw new Error('Dynamic pathname is not allowed for WebSocket!');

        return this;
    }

    varsLiteral: string = '';
    varsValues: any[] = [];
    varsArgsName: string[] = [];
    private currentVarsIndex = 0;

    /**
     * Insert a variable into the function
     */
    inject(name: string, value: any) {
        this.varsLiteral += `${name}=v${this.currentVarsIndex},`;
        this.varsValues.push(value);
        this.varsArgsName.push('v' + this.currentVarsIndex);
        ++this.currentVarsIndex;

        return this;
    }

    /**
     * Add a handler to the router
     * @param method 
     * @param path 
     * @param handler 
     */
    use<T extends string>(method: string | string[], path: T, handler: Handler<T>): this;

    /**
     * Add 404 handler to the router
     * @param type
     * @param handler
     */
    use(type: 404, handler: Handler): this;

    /**
     * Add the default 404 handler to the router
     * @param type
     * @param handler
     */
    use(type: 404): this;

    /**
     * Add an error handler to the router
     * @param type
     * @param handler
     */
    use(type: 500 | 'error', handler: ErrorHandler): this;

    /**
     * Add the default 500 handler to the router
     * @param type
     * @param handler
     */
    use(type: 500 | 'error'): this;

    /**
     * Add a pre-handler to the router
     * @param type
     * @param handler if handler returns true execute the return statement
     */
    use(type: 'pre', handler: Handler): this;

    /**
     * Add a pre-handler to the router
     * @param type
     * @param handler The pre-handler will returns directly if the result is not `undefined`. If handler is asynchronous it should be created using `async` keyword.
     */
    use(type: 'pre', handler: Handler, response: boolean): this;

    use(...args: any[]) {
        switch (args[0]) {
            case 404:
                this.fn404 = args[1] || false;
                return this;
            case 500:
            case 'error':
                this.error = args[1] || default505;
                return this;
            case 'pre':
                this.fnPre = args[1];
                if (args[2] === true)
                    this.fnPre.response = true;

                return this;
            default: {
                // Normal parsing
                let [method, path, handler] = args;
                if (!Array.isArray(method))
                    method = [method];

                if (path.includes(':') || path.includes('*')) {
                    if (handler.isMacro)
                        throw new Error('Macros are not allowed for dynamic routes');

                    if (!this.router) {
                        // @ts-ignore
                        this.router = new Radx;
                        this.router.normalUsage = false;
                    }
                    for (const mth of method)
                        this.router.add(mth, path, handler);
                } else {
                    // Store static route separately
                    if (!this.static[path])
                        this.static[path] = {};
                    for (const mth of method)
                        this.static[path][mth] = handler;
                }

                return this;
            }
        }
    }

    /**
     * Add a plugin
     * @param plugin 
     */
    plug(plugin: Plugin | {
        plugin: Plugin
    }) {
        if (typeof plugin === 'object') plugin.plugin(this);
        else plugin(this);
        return this;
    }

    /**
     * Inject a property
     * @param name
     * @param value 
     */
    store<K extends string, V>(name: K, value: V): Router<I & { [key in K]: V }> {
        if (!this.injects)
            this.injects = {};
        this.injects[name] = value;
        return this;
    }

    /**
     * Fetch handler.
     * @param request Incoming request
     * @param server Current Bun server
     */
    get fetch(): Handler {
        if (!this.websocket)
            this.websocket = { message: createWSHandler('message') };
        this.websocket.open = createWSHandler('open');
        this.websocket.drain = createWSHandler('drain');
        this.websocket.close = createWSHandler('close');

        this.router?.composeFind();

        return createFetch(this);
    };

    /**
     * Start accepting connections
     * This attach the server to the globalThis object as well
     */
    ls() {
        globalThis.server = Bun.serve(this);
    }

    /**
     * Add a GET method handler to the router 
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    get<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a HEAD method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    head<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a POST method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    post<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a PUT method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    put<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a DELETE method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    delete<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a CONNECT method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    connect<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a OPTIONS method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    options<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a TRACE method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    trace<T extends string>(path: T, handler: Handler<T, I>): this;

    /**
     * Add a PATCH method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    patch<T extends string>(path: T, handler: Handler<T, I>): this;
}

/**
 * Specific plugin for router
 */
export interface Plugin {
    (app: Router): any
}
export { createFetch, Radx };
