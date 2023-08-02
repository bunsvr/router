import { Errorlike, GenericServeOptions, Server, ServerWebSocket, TLSOptions, WebSocketHandler } from 'bun';
import { Handler } from './types';
import Radx from './router';
import composeRouter from './router/compose';
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
     * Enable inspect mode
     */
    inspector?: boolean;

    /**
     * Should be set to something like http://localhost:3000
     * This enables optimizations for path parsing
     */
    base?: string;

    /**
     * Choose to parse path or not
     */
    parsePath?: boolean;
}

const serverError = { status: 500 };
const default505 = () => new Response(null, serverError);

export function macro(fn: Handler<string>) {
    const fnStr = fn.toString();
    if (!fnStr.startsWith('()') && !fnStr.startsWith('(r)') && !fnStr.startsWith('(r, s)') && !fnStr.startsWith('(_, s)'))
        throw new Error('Macros should have no argument, or one argument named `r` for request, or one argument named `s` for the store, or these two: ' + fnStr);

    // @ts-ignore detect by createFetch
    fn.isMacro = true;
    return fn;
}

export function createWSHandler(name: string) {
    const argsList = 'w' + (name === 'close' ? ',c,m' : '');
    // Optimization: message handler should exist
    const body = name === 'message' 
        ? 'return function(w,m){w.data._.message(w,m)}' 
        : `const n='${name}';return function(${argsList}){if(n in w.data._)w.data._.${name}(${argsList})}`;
    return Function(body)();
}

// Fix missing types
export interface Router extends Options {};

/**
 * A Stric router
 * 
 * Note: This will run *only* the first route found
 */
export class Router<I extends Dict<any> = {}> implements Options {
    /**
     * Internal dynamic path router 
     */
    router: Radx<Handler>;
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
    // TODO: Makes WS works nicely
    ws<T extends string>(path: T, handler: WebSocketHandler<Request<T>>) {
        if (!this.webSocketHandlers)
            this.webSocketHandlers = [];

        // @ts-ignore Should use macros instead
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

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

                if (!this.router) 
                    this.router = new Radx;
                    
                for (const mth of method)
                    this.router.add(mth, path, handler);
                
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

    callArgs: string = 'r';
    /**
     * Inject a property
     * @param name
     * @param value 
     */
    store<K extends string, V>(name: K, value: V): Router<I & { [key in K]: V }> {
        if (!this.injects) {
            this.injects = {};
            this.callArgs += ',s';
        }
        this.injects[name] = value;
        return this;
    }

    private generatedFetch: any;
    /**
     * Fetch handler. Once the handler is generated no other can be
     * @param request Incoming request
     * @param server Current Bun server
     */
    get fetch(): Handler {
        if (this.generatedFetch) return this.generatedFetch;

        if (this.webSocketHandlers) {
            this.websocket ||= { message: createWSHandler('message') };
            this.websocket.open ||= createWSHandler('open');
            this.websocket.drain ||= createWSHandler('drain');
            this.websocket.close ||= createWSHandler('close');
        }

        if (!this.router) return () => {};
        // @ts-ignore
        const defaultReturn = this.fn404 === false 
            ? 'return new Response(null,n)' : (
                this.fn404 ? `return c_(${this.callArgs})` : 'return'
            );

        const res = composeRouter(this.router, this.callArgs, defaultReturn);

        if (this.injects) {
            res.literals.push('s');
            res.handlers.push(this.injects);
        }

        if (this.webSocketHandlers) {
            for (let i = 0; i < this.webSocketHandlers.length; ++i) {
                res.literals.push('w' + i);
                res.handlers.push(this.webSocketHandlers[i]);
            }
        }

        // @ts-ignore Inject headers
        if (this.fn404 === false) {
            res.literals.push('n');
            res.handlers.push({status: 404});
        } else if (this.fn404) {
            res.literals.push('c_');
            res.handlers.push(this.fn404);
        }
        

        if (this.fnPre) {
            res.literals.push('p');
            res.handlers.push(this.fnPre);

            if (this.fnPre.response) res.fn = `const b=p(${this.callArgs});if(b!==undefined)return b;` + res.fn;
            else res.fn = `if(p(${this.callArgs})!==undefined)return;`;
        }

        res.fn = getPathParser(this) + res.fn + (defaultReturn === 'return' ? '' : defaultReturn);
        return this.generatedFetch = Function(...res.literals, `return function(${this.callArgs}){${res.fn}}`)(...res.handlers);
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

function getPathParser(app: Router) {
    const hostExists = !!app.base, 
        exactHostLen = hostExists ? app.base.length + 1 : 'a';
    return (hostExists 
        ? '' 
        : `const a=r.url.indexOf('/',12)+1;`
    ) + `r.query=r.url.indexOf('?',${exactHostLen});`
        + `r.path=r.query===-1?r.url.substring(${exactHostLen}):r.url.substring(${exactHostLen},r.query);`
}

/**
 * Specific plugin for router
 */
export interface Plugin {
    (app: Router): any
}
export { Radx, composeRouter as compose };
