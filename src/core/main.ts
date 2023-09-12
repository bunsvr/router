import type { WebSocketHandler, Serve } from 'bun';
import { BodyParser, FetchMeta, Handler, WSContext, ConcatPath, ServeOptions, BodyHandler, ErrorHandler, RouteOptions } from './types';
import Radx from './router';
import composeRouter from './router/compose';
import { convert, methodsLowerCase as methods } from './constants';
import {
    requestObjectName, storeObjectName,
    urlStartIndex, wsPrefix, requestURL, requestQueryIndex,
    serverErrorHeader
} from './router/constants';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch' | 'all' | 'guard' | 'reject';
export type RouterMethods<I extends Dict<any>, R extends string> = {
    [K in HttpMethod]: <T extends string, O extends RouteOptions>(
        path: T, handler: O extends { body: infer B }
            ? (
                B extends BodyParser
                ? Handler<ConcatPath<R, T>, I, B>
                : Handler<ConcatPath<R, T>, I>
            ) : Handler<ConcatPath<R, T>, I>,
        options?: O
    ) => Router<I>;
};

/**
 * Specific plugin for router
 */
export interface Plugin<I extends Dict<any> = Dict<any>, R = any> {
    (app: Router<I>): Router<I & R> | void | Promise<Router<I & R> | void>
}

export interface Router<I> extends ServeOptions, RouterMethods<I, '/'> { };

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
    private fn404: Handler;
    private fn400: Handler;
    readonly storage: I;
    private injects: Record<string, any>;
    record: Record<string, Record<string, Handler>> = {};

    /**
     * Create a router.
     *
     * If a `PORT` env is set, the port will be the value specified.
     */
    constructor(opts: Partial<Serve> = {}) {
        Object.assign(this, opts);

        let method: string;
        for (method of methods) {
            const METHOD = method.toUpperCase();
            this[method] = (path: string, handler: Handler, opts: any) => {
                if (opts) for (const prop in opts)
                    handler[prop] = opts[prop];
                return this.use(METHOD, path, handler);
            }
        }

        // Automatically set port
        if (Bun.env.PORT) this.port = Number(Bun.env.PORT);
    }

    /**
     * Set an alias for a path
     */
    alias(name: string, origin: string): this {
        if (origin in this.record) {
            if (!(name in this.record)) this.record[name] = {};

            let k: string;
            for (k in this.record[origin])
                this.record[name][k] = this.record[origin][k];

            return this;
        }
        throw new Error('Origin pathname not registered yet!');
    }

    // Handle websocket
    private webSocketHandlers: WebSocketHandler[] = [];
    /**
     * Handling WebSocket connections. Only works in Bun 
     * @param path 
     * @param handler 
     */
    ws<D extends Dict<any> = {}, T extends string = string>(path: T, handler: WebSocketHandler<WSContext<T, I> & D>) {
        // @ts-ignore Should use macros instead
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

        return this;
    }

    /**
     * Inject a variable into the fetch function scope
     */
    inject(name: string, value: any) {
        if (name.charCodeAt(0) === 95)
            throw new Error('Name cannot have prefix `_` to avoid collision with internal parameters!');

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
     * Add a 404 handler to the router
     * @param type
     * @param handler
     */
    use(type: 404, handler: Handler): this;

    /**
     * Add the default 404 handler to the router
     * @param type
     */
    use(type: 404): this;

    /**
     * Add a 400 handler to the router when parsing body failed
     * @param type
     * @param handler
     */
    use(type: 400, handler: BodyHandler): this;

    /**
     * Add the default 400 handler to the router when parsing body failed
     * @param type
     */
    use(type: 400): this;

    /**
     * Add an error handler to the router
     * @param type
     * @param handler
     */
    use(type: 500 | 'error', handler: ErrorHandler): this;

    /**
     * Add the default 500 handler to the router
     * @param type
     */
    use(type: 500 | 'error'): this;

    /**
     * Attach the store to the router
     * @param type
     * @param store
     */
    use<T>(type: 'store', store: T): Router<I & T>;

    use(...args: any[]) {
        switch (args[0]) {
            case 404:
                this.fn404 = args[1] || false;
                break;
            case 400:
                this.fn400 = args[1] || false;
                break;
            case 500:
            case 'error':
                this.error = args[1] || default505;
                break;
            case 'store':
                this.initStore();
                Object.assign(this.storage, args[1]);
                break;
            default:
                // Normal parsing
                let [method, path, handler] = args, mth: string;
                path = convert(path);

                if (!Array.isArray(method))
                    method = [method];

                if (!this.record[path]) this.record[path] = {};

                for (mth of method)
                    this.record[path][mth] = handler;

                break;
        }

        return this;
    }

    /**
     * Create the store if not exists
     */
    private initStore() {
        if (!this.storage) {
            // @ts-ignore
            this.storage = {};
            this.callArgs += ',' + storeObjectName;
        }
    }

    /**
     * Register this router as a plugin, which mount all routes, storage and injects (can be overritten)
     */
    plugin(app: Router) {
        let k: string, k1: string;

        // Assign route records
        for (k in this.record) {
            if (k in app.record)
                for (k1 in this.record[k])
                    app.record[k][k1] = this.record[k][k1];

            else app.record[k] = this.record[k];
        }

        // Assign injects 
        if (this.injects) {
            if (app.injects)
                for (k in this.injects)
                    app.injects[k] = this.injects[k];

            else for (k in this.injects)
                app.inject(k, this.injects[k]);
        }

        // Assign storage
        if (this.storage) {
            if (app.storage)
                for (k in this.storage)
                    app.storage[k] = this.storage[k];

            else for (k in this.storage)
                app.store(k, this.storage[k]);
        }
    }

    /**
     * Mount another app to a path
     */
    mount(path: string, app: { fetch: (request: Request) => any }) {
        this.all(path, app.fetch);
    }

    /**
     * All resolving plugin
     */
    readonly plugins: Promise<any>[];

    /**
     * Add a plugin
     * @param plugin 
     */
    plug<R>(plugin: Plugin<I, R> | {
        plugin: Plugin<I, R>
    }) {
        const res = typeof plugin === 'object'
            ? plugin.plugin(this)
            : plugin(this);

        // Add to queue if not resolved
        if (res instanceof Promise) this.plugins.push(res);

        return this as unknown as Router<I & R>;
    }

    callArgs: string = requestObjectName;
    /**
     * Inject a property
     * @param name
     * @param value 
     */
    store<K extends string, V>(name: K, value: V): Router<I & { [key in K]: V }> {
        this.initStore();
        // @ts-ignore
        this.storage[name] = value;
        return this;
    }

    /**
     * Return the value associated with 
     * the key in the store
     */
    item(key: keyof I) {
        return this.storage[key];
    }

    private assignRouter() {
        if (Object.keys(this.record).length === 0) return;
        this.router = new Radx;

        let store: any, path: string, method: string;
        for (path in this.record) {
            store = this.router.add(path);

            for (method in this.record[path])
                store[method] = this.record[path][method];
        }
    }

    /**
     * Get the literal, parameters and parameters value Stric uses to compose the fetch function.
     *
     * This method is intended for advanced usage.
     */
    get meta(): FetchMeta {
        if (Object.keys(this.record).length === 0)
            throw new Error('Please register a route first!');

        this.assignRouter();

        // Assign websocket
        if (this.webSocketHandlers) {
            this.websocket ||= { message: createWSHandler('message') };
            this.websocket.open ||= createWSHandler('open');
            this.websocket.drain ||= createWSHandler('drain');
            this.websocket.close ||= createWSHandler('close');
        }

        const res = composeRouter(
            this.router, this.callArgs, this.webSocketHandlers,
            this.base ? this.base.length + 1 : urlStartIndex,
            this.fn400, this.fn404
        );

        if (this.storage)
            res.store[storeObjectName] = this.storage;

        // People pls don't try to use this
        if (this.injects) {
            let iter: string;

            for (iter in this.injects)
                res.store[iter] = this.injects[iter];
        }

        res.fn = getPathParser(this) + res.fn;
        return {
            params: Object.keys(res.store),
            body: `return function(${requestObjectName}){${res.fn}}`,
            values: Object.values(res.store)
        };
    }

    /**
     * Fetch handler. 
     * @param request Incoming request
     * @param server Current Bun server
     */
    get fetch() {
        if (globalThis.Bun) globalThis.Bun.gc(true);
        return buildFetch(this.meta);
    };
}

const default505 = () => new Response(null, serverErrorHeader);

export function macro<T extends string>(fn: Handler<T> | string): Handler<any> {
    if (typeof fn === 'string') return macro(Function(`return()=>new Response('${fn}')`)());

    fn.isMacro = true;
    return fn;
}

function createWSHandler(name: string) {
    const argsList = 'w' + (name === 'close' ? ',c,m' : '');
    // Optimization: message handler should exist
    const body = name === 'message'
        ? 'return function(w,m){w.data._.message(w,m)}'
        : `return function(${argsList}){if('${name}' in w.data._)w.data._.${name}(${argsList})}`;
    return Function(body)();
}

function getPathParser<T>(app: Router<T>) {
    return (typeof app.base === 'string'
        ? '' : `${urlStartIndex}=${requestURL}.indexOf('/',${app.uriLen ?? 12})+1;`
    ) + `${requestQueryIndex}=${requestURL}.indexOf('?',${typeof app.base === 'string'
        ? app.base.length + 1 : urlStartIndex
    });` + `if(${requestQueryIndex}===-1)${requestQueryIndex}=${requestURL}.length;`;
}

/**
 * Build a fetch function from fetch metadata
 */
export function buildFetch(meta: FetchMeta): (req: Request) => any {
    return Function(...meta.params, meta.body)(...meta.values);
}

export default Router;
export { Radx };
export * from './types';
