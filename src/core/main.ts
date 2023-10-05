import { type WebSocketHandler } from 'bun';
import type {
    RouterMethods, FetchMeta, Handler, WSContext, ServeOptions,
    BodyHandler, ErrorHandler, RouterMeta, RouterPlugin, ResponseWrap
} from './types';
import { wrap } from './types';
import Radx from './router';
import compileRouter from './router/compiler';
import { convert, methodsLowerCase as methods } from './constants';
import {
    requestObjectName, urlStartIndex, requestQueryIndex,
    serverErrorHandler, requestURL, appDetail
} from './router/compiler/constants';

export interface Router extends ServeOptions, RouterMethods<'/'> { };

/**
 * A Stric router
 * 
 * Note: This will run *only* the first route found
 */
export class Router {
    /**
     * Internal dynamic path router 
     */
    router: Radx<Handler>;
    private fn404: Handler;
    private fn400: Handler;
    private injects: Record<string, any>;
    record: Record<string, Record<string, Handler>> = {};

    /**
     * Create a router.
     *
     * If a `PORT` env is set, the port will be the value specified.
     */
    constructor(opts: Partial<ServeOptions> = {}) {
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
        if (Bun.env.PORT)
            this.port = Number(Bun.env.PORT);
        else if (!('port' in this))
            this.port = 3000;

        if (!('hostname' in this))
            this.hostname = '127.0.0.1';

        // Enable optimizer
        if (this.requestOptimization !== false)
            optimize();
    }

    /**
     * Use the default response wrapper for a group of subroutes
     */
    wrap(path: string): this;

    /**
     * Add a response wrapper for subroutes of path.
     *
     * Wrap will not wrap reject responses
     */
    wrap(path: string, handler: ResponseWrap = 'default') {
        if (typeof handler === 'string')
            handler = wrap[handler];

        // @ts-ignore
        this.use('WRAP', path, handler);
        return this;
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
    ws<D extends Dict<any> = Dict<any>, T extends string = string>(path: T, handler: WebSocketHandler<WSContext<T> & D>) {
        // @ts-ignore Should use macros instead
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

        return this;
    }

    /**
     * Inject a variable into the fetch function scope
     */
    inject(name: string, value: any, warning: boolean = true) {
        if (name.charCodeAt(0) === 95 && warning)
            console.warn('Name should not have prefix `_` to avoid collision with internal parameters!');

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
                this.error = args[1] || serverErrorHandler;
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
    }

    /**
     * Mount another WinterCG compliant app to a path
     */
    mount(path: string, app: { fetch: (request: any) => any }) {
        this.all(path, app.fetch as any);
    }

    /**
     * All resolving plugin
     */
    readonly plugins: Promise<any>[] = [];

    private plugOne(plugin: RouterPlugin) {
        // Ignore null and undefined plugins
        if (!plugin) return;

        const res = typeof plugin === 'object'
            ? plugin.plugin(this)
            : plugin(this);

        // Add to queue if not resolved
        if (res instanceof Promise) this.plugins.push(res);
    }

    /**
     * Set a property
     */
    set<K extends keyof this>(v: K, value: this[K]) {
        this[v] = value;
        return this;
    }

    /**
     * Add plugins 
     */
    plug(...plugins: RouterPlugin[]) {
        let p: any;
        for (p of plugins) this.plugOne(p);
        return this;
    }

    /**
     * Resolve all loading plugins.
     * Call this before serving.
     */
    resolve() {
        if (this.plugins.length !== 0)
            return Promise.allSettled(this.plugins);
    }

    /**
     * Get the literal, parameters and parameters value Stric uses to compose the fetch function.
     *
     * This method is intended for advanced usage.
     */
    get meta(): FetchMeta {
        // Check whether a path handler does exists
        let key: string, hasRecord: boolean;
        for (key in this.record) {
            hasRecord = true;
            break;
        }

        // Assign records to the router
        if (!hasRecord) throw new Error('No route has been assigned yet');
        this.router = new Radx;

        let store: any, method: string;
        for (key in this.record) {
            store = this.router.add(key);

            for (method in this.record[key])
                store[method] = this.record[key][method];
        }

        // Assign websocket
        if (this.webSocketHandlers.length !== 0) {
            this.websocket ||= { message: createWSHandler('message') };
            this.websocket.open ||= createWSHandler('open');
            this.websocket.drain ||= createWSHandler('drain');
            this.websocket.close ||= createWSHandler('close');
        }

        // Compose the router
        const res = compileRouter(
            this.router, this.webSocketHandlers,
            this.base ? this.base.length + 1 : urlStartIndex,
            this.fn400, this.fn404
        );

        // People pls don't try to use this
        if (this.injects) for (key in this.injects)
            res.store[key] = this.injects[key];

        // Store the ref of details 
        res.store[appDetail] = this.details;

        return {
            params: Object.keys(res.store),
            body: `return ${requestObjectName}=>{${getPathParser(this) + res.fn}}`,
            values: Object.values(res.store)
        };
    }

    /**
     * Fetch handler. 
     * @param request Incoming request
     * @param server Current Bun server
     */
    get fetch() {
        return buildFetch(this.meta);
    };

    /**
     * Start an HTTP server at specified port (defaults to `3000`) and host (defaults to `127.0.0.1`).
     */
    listen(gc: boolean = true) {
        if (gc) Bun.gc(true);

        const { fetch, ...rest } = this,
            s = Bun.serve({ ...rest, fetch });

        // Additional details
        this.details.https = !!(this.tls || this.ca || this.key);
        this.details.defaultPort = s.port === 80 || s.port === 443;
        this.details.host = `${s.hostname + (this.details.defaultPort ? '' : ':' + s.port)}`;
        this.details.base = `http${this.details.https ? 's' : ''}://${this.details.host}`;
        this.details.dev = s.development;
        this.details.server = s;
        this.details.router = this;

        // Log additional info
        console.info(`Started an HTTP server at ${this.details.base} in ${s.development ? 'development' : 'production'} mode`);
        return this;
    }

    // Only available when `listen()` is used.
    // @ts-ignore
    details: RouterMeta = {};
}

export function macro<T extends string>(fn: Handler<T> | string | number | boolean | null | undefined | object): Handler {
    if (fn === null || fn === undefined)
        fn = Function('return()=>new Response')() as Handler;
    else if (typeof fn === 'string')
        fn = Function(`return()=>new Response('${fn}')`)() as Handler;
    else if (typeof fn !== 'function')
        fn = Function(`return()=>new Response('${JSON.stringify(fn)}')`)() as Handler;

    // @ts-ignore
    fn.macro = true;
    // @ts-ignore
    return fn;
}

function createWSHandler(name: string) {
    const argsList = 'w' + (name === 'close' ? ',c,m' : '');
    // Optimization: message handler should exist
    return Function(name === 'message'
        ? 'return (w,m)=>{w.data._.message(w,m)}'
        : `return (${argsList})=>{if('${name}'in w.data._)w.data._.${name}(${argsList})}`
    )();
}

function getPathParser(app: Router) {
    return (typeof app.base === 'string'
        ? '' : `${urlStartIndex}=${requestURL}.indexOf('/',${app.uriLen ?? 12})+1;`
    ) + `${requestQueryIndex}=${requestURL}.indexOf('?',${typeof app.base === 'string'
        ? app.base.length + 1 : urlStartIndex
    });`;
}

/**
 * Build a fetch function from fetch metadata
 */
export function buildFetch(meta: FetchMeta): (req: Request) => any {
    return Function(...meta.params, meta.body)(...meta.values);
}

/**
 * Will work if Request proto is modifiable
 */
function optimize() {
    // @ts-ignore
    Request.prototype.path = 0;
    // @ts-ignore
    Request.prototype.query = 0;
    // Assume everytime path and query are numbers 

    // @ts-ignore
    Request.prototype.data = null;
    // @ts-ignore
    Request.prototype.params = null;
}

/**
 * Shorthand for `new Router().plug`
 */
export function router(...plugins: RouterPlugin[]) {
    return new Router().plug(...plugins);
}

export default Router;
export { wrap };
export type * from './types';

// Export constants for AoT compiling
export * from './router/exports';
