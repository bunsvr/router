import { Errorlike, GenericServeOptions, Server, ServerWebSocket, TLSOptions, WebSocketHandler } from 'bun';
import { BodyParser, Handler, WSContext } from './types';
import Radx from './router';
import composeRouter from './router/compose';
import { convert, methodsLowerCase as methods } from './constants';

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
     * Choose to parse path or not, must be used with `base`
     */
    parsePath?: boolean;

    /**
     * Whether to match query or not, must be used with `base` and `parsePath`
     */
    strict?: boolean;
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch' | 'all' | 'guard';
export type RouterMethods<I extends Dict<any>> = {
    [K in HttpMethod]: <T extends string, O extends { body: BodyParser } = { body: 'none' }>(
        path: T, handler: O extends { body: infer B } 
            ? (B extends BodyParser ? Handler<T, I, B> : Handler<T, I>)
            : Handler<T, I>,
        options?: O
    ) => Router<I>;
};

/**
 * Specific plugin for router
 */
export interface Plugin<I extends Dict<any> = Dict<any>> {
    (app: Router<I>): any;
}

type RouterPlugin<I> = Plugin<I> | {
    plugin: Plugin<I>
};

export interface Router<I> extends Options, RouterMethods<I> {};

/**
 * A Stric router
 * 
 * Note: This will run *only* the first route found
 */
export class Router<I extends Dict<any> = Dict<any>> {
    /**
     * Internal dynamic path router 
     */
    router: Radx<Handler>;
    // This value is read by the createFetch() method
    private fn404: Handler;
    storage: Record<string, any>;
    injects: Record<string, any>;
    private fnPre: PreHandler;
    private handlersRec: Record<string, Record<string, Handler>> = {};
    
    /**
     * Create a router
     */
    constructor(opts: Options = {}) {
        Object.assign(this, opts);
        if (!('parsePath' in opts)) this.parsePath = true;

        for (const method of methods) {
            const METHOD = method.toUpperCase();
            this[method] = (path: string, handler: Handler, opts: any) => {
                if (opts) for (const prop in opts) 
                    handler[prop] = opts[prop];
                return this.use(METHOD, path, handler);
            }
        }
    }

    // Handle websocket
    private webSocketHandlers: WebSocketHandler[];
    /**
     * Handling WebSocket connections. Only works in Bun
     * 
     * WebSocket pathname cannot collide with any other pathname     * with GET method
     * @param path 
     * @param handler 
     */
    ws<T extends string>(path: T, handler: WebSocketHandler<WSContext<T, I>>) {
        if (!this.webSocketHandlers)
            this.webSocketHandlers = [];

        // @ts-ignore Should use macros instead
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

        return this;
    }

    /**
     * Inject a variable
     */
    inject(name: string, value: any) {
        if (!this.injects) this.injects = {};
        this.injects[name] = value;
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
            default:
                // Normal parsing
                let [method, path, handler] = args;
                path = convert(path);

                if (!Array.isArray(method))
                    method = [method];

                if (!this.handlersRec[path]) this.handlersRec[path] = {};
                    
                for (const mth of method)
                    this.handlersRec[path][mth] = handler;
                
                return this;
        }
    }

    /**
     * Register this router as a plugin, which mount all routes, storage and injects (can be overritten)
     */
    plugin(app: Router) {
        let o: any;
        for (const path in this.handlersRec) {
            o = this.handlersRec[path];

            if (path in app.handlersRec) Object.assign(app.handlersRec[path], o);
            else app.handlersRec[path] = o;
        }

        if (this.injects) {
            if (app.injects) Object.assign(app.injects, this.injects);

            else for (const key in this.injects) 
                app.inject(key, this.injects[key]);
        }

        if (this.storage) {
            if (app.storage) Object.assign(app.storage, this.storage);

            else for (const key in this.storage) 
                app.store(key, this.storage[key]);
        }
    }

    /**
     * Mount another app to a path
     */
    mount(path: string, app: { fetch: (request: Request) => any }) {
        this.all(path, app.fetch);
    }

    /**
     * Add a plugin
     * @param plugin 
     */
    plug(...plugins: RouterPlugin<I>[]) {
        for (const plugin of plugins) {
            if (typeof plugin === 'object') plugin.plugin(this);
            else plugin(this);
        }
        return this;
    }

    callArgs: string = 'r';
    /**
     * Inject a property
     * @param name
     * @param value 
     */
    store<K extends string, V>(name: K, value: V): Router<I & { [key in K]: V }> {
        if (!this.storage) {
            this.storage = {};
            this.callArgs += ',s';
        }
        this.storage[name] = value;
        return this;
    }

    private assignRouter() {
        if (Object.keys(this.handlersRec).length === 0 || this.router) return;
        this.router = new Radx;

        for (const path in this.handlersRec) {
            const store = this.router.add(path);
            for (const method in this.handlersRec[path])
                store[method] = this.handlersRec[path][method];
        }
    }

    /**
     * Fetch handler. 
     * @param request Incoming request
     * @param server Current Bun server
     */
    get fetch(): Handler {
        if (!this.parsePath && !this.base) throw new Error('Base needs to be provided if `parsePath` is set to true');
        this.assignRouter();

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

        const res = composeRouter(this.router, this.callArgs, defaultReturn, this.parsePath, this.parsePath ? 0 : this.base.length + 1);

        if (this.storage) {
            res.literals.push('s');
            res.handlers.push(this.storage);
        }

        if (this.webSocketHandlers) {
            for (let i = 0; i < this.webSocketHandlers.length; ++i) {
                res.literals.push('w' + i);
                res.handlers.push(this.webSocketHandlers[i]);
            }
        }

        // People pls don't try to use this
        if (this.injects) {
            for (const key in this.injects) {
                res.literals.push(key);
                res.handlers.push(this.injects[key]);
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
        return Function(...res.literals, `return function(${this.callArgs}){${res.fn}}`)(...res.handlers);
    };

    /**
     * Start accepting connections
     * This attach the server to the globalThis object as well
     */
    ls() {
        globalThis.server = Bun.serve(this);
    }
}

const serverError = { status: 500 };
const default505 = () => new Response(null, serverError);

export function macro(fn: Handler<string> | string): Handler<string> {
    if (typeof fn === 'string') return macro(Function(`return()=>new Response('${fn}')`)());
 
    // @ts-ignore detect by createFetch
    fn.isMacro = true;
    return fn;
}

function createWSHandler(name: string) {
    const argsList = 'w' + (name === 'close' ? ',c,m' : '');
    // Optimization: message handler should exist
    const body = name === 'message' 
        ? 'return function(w,m){w.data._.message(w,m)}' 
        : `const n='${name}';return function(${argsList}){if(n in w.data._)w.data._.${name}(${argsList})}`;
    return Function(body)();
}

function getPathParser(app: Router) {
    const hostExists = !!app.base, 
        exactHostLen = hostExists ? app.base.length + 1 : 'a';

    if (app.parsePath)
        return (hostExists ? '' : `const a=r.url.indexOf('/',12)+1;`) 
            + `r.query=r.url.indexOf('?',${exactHostLen});`
            + `r.path=r.query===-1?r.url.substring(${exactHostLen}):r.url.substring(${exactHostLen},r.query);`;
    
    return `r.query=r.url.indexOf('?',${exactHostLen});if(r.query===-1)r.query=r.url.length;`;
}

export default Router;
export { Radx, composeRouter as compose };
