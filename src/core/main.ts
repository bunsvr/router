import { Errorlike, GenericServeOptions, Server, ServerWebSocket, TLSOptions, WebSocketHandler } from 'bun';
import { BodyParser, FetchMeta, Handler, WSContext } from './types';
import Radx from './router';
import composeRouter from './router/compose';
import { convert, methodsLowerCase as methods } from './constants';
import { nfHandler, requestObjectName, storeObjectName, wsPrefix } from './router/constants';

/**
 * An error handler
 */
export interface ErrorHandler {
    (this: Server, err: Errorlike): any
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
     * Should be set to something like `http://localhost:3000`
     * This enables optimizations for path parsing
     */
    base?: string;

    /**
     * Choose to parse path or not
     */
    parsePath?: boolean;

    /**
     * The minimum length of the request domain.
     *
     * Use this instead of `base` to work with subdomain
     */
    uriLen?: number;
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch' | 'all' | 'guard' | 'reject';
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

export interface Router<I> extends Options, RouterMethods<I> { };

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
    storage: I;
    injects: Record<string, any>;
    record: Record<string, Record<string, Handler>> = {};

    /**
     * Create a router
     */
    constructor(opts: Options = {}) {
        Object.assign(this, opts);
        if (!('parsePath' in opts)) this.parsePath = false;

        for (const method of methods) {
            const METHOD = method.toUpperCase();
            this[method] = (path: string, handler: Handler, opts: any) => {
                if (opts) for (const prop in opts)
                    handler[prop] = opts[prop];
                return this.use(METHOD, path, handler);
            }
        }
    }

    /**
     * Set an alias for a path
     */
    alias(name: string, origin: string): this {
        if (origin in this.record) {
            if (!(name in this.record)) this.record[name] = {};

            Object.assign(this.record[name], this.record[origin]);
            return this;
        }
        throw new Error('Origin pathname not registered yet!');
    }

    // Handle websocket
    private webSocketHandlers: WebSocketHandler[];
    /**
     * Handling WebSocket connections. Only works in Bun 
     * @param path 
     * @param handler 
     */
    ws<D extends Dict<any> = {}, T extends string = string>(path: T, handler: WebSocketHandler<WSContext<T, I> & D>) {
        if (!this.webSocketHandlers)
            this.webSocketHandlers = [];

        // @ts-ignore Should use macros instead
        this.get(path, this.webSocketHandlers.length);
        this.webSocketHandlers.push(handler);

        return this;
    }

    /**
     * Inject a variable into the fetch function scope
     */
    inject(name: string, value: any) {
        if (name[0] === '_')
            throw new Error('Name cannot have prefix `_` to avoid collision with internal parameters!');

        if (!this.injects) this.injects = {};

        if (name in this.injects)
            console.warn(`Injected name \`${name}\` conflicted with another name!`);

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
                return this;
            case 500:
            case 'error':
                this.error = args[1] || default505;
                return this;
            case 'store':
                this.initStore();
                Object.assign(this.storage, args[1]);
                return this;
            default:
                // Normal parsing
                let [method, path, handler] = args;
                path = convert(path);

                if (!Array.isArray(method))
                    method = [method];

                if (!this.record[path]) this.record[path] = {};

                for (const mth of method)
                    this.record[path][mth] = handler;

                return this;
        }
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
        let o: any;
        for (const path in this.record) {
            o = this.record[path];

            if (path in app.record) Object.assign(app.record[path], o);
            else app.record[path] = o;
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
        if (Object.keys(this.record).length === 0 || this.router) return;
        this.router = new Radx;

        for (const path in this.record) {
            const store = this.router.add(path);
            for (const method in this.record[path])
                store[method] = this.record[path][method];
        }
    }

    /**
     * Get the literal, parameters and parameters value Stric uses to compose the fetch function.
     *
     * This method is intended for advanced usage.
     */
    get meta(): FetchMeta {
        this.assignRouter();

        if (this.webSocketHandlers) {
            this.websocket ||= { message: createWSHandler('message') };
            this.websocket.open ||= createWSHandler('open');
            this.websocket.drain ||= createWSHandler('drain');
            this.websocket.close ||= createWSHandler('close');
        }

        if (!this.router) throw new Error('Please register a route first!');
        // @ts-ignore
        const defaultReturn = this.fn404 === false
            ? `return new Response(null,${nfHandler})` : (
                this.fn404 ? `return ${nfHandler}(${this.callArgs})` : 'return'
            );

        const res = composeRouter(
            this.router, this.callArgs, defaultReturn,
            this.parsePath, this.parsePath ? 0 : (
                this.base ? this.base.length + 1 : 'a'
            )
        );

        if (this.storage) {
            res.literals.push(storeObjectName);
            res.handlers.push(this.storage);
        }

        if (this.webSocketHandlers) {
            for (let i = 0; i < this.webSocketHandlers.length; ++i) {
                res.literals.push(wsPrefix + i);
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
        if (this.fn404 || this.fn404 === false) {
            res.literals.push(nfHandler);

            // @ts-ignore Inject headers
            if (this.fn404 === false)
                res.handlers.push({ status: 404 });
            else if (this.fn404)
                res.handlers.push(this.fn404);
        }

        res.fn = getPathParser(this) + res.fn;
        return {
            params: res.literals,
            body: `return function(${requestObjectName}){${res.fn}${defaultReturn === 'return' ? '' : defaultReturn}}`,
            values: res.handlers
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
     * Start accepting connections
     * This attach the server to the globalThis object as well
     */
    ls() {
        globalThis.server = Bun.serve(this);
    }
}

const serverError = { status: 500 };
const default505 = () => new Response(null, serverError);

export function macro<T extends string>(fn: Handler<T> | string): Handler<T> {
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
        : `return function(${argsList}){if('${name}' in w.data._)w.data._.${name}(${argsList})}`;
    return Function(body)();
}

function getPathParser<T>(app: Router<T>) {
    const hostExists = !!app.base,
        exactHostLen = hostExists ? app.base.length + 1 : 'a',
        uriStart = app.uriLen || 12,
        url = requestObjectName + '.url',
        query = requestObjectName + '.query',
        additionalPart = (hostExists ? '' : `const a=${url}.indexOf('/',${uriStart})+1;`);

    if (app.parsePath)
        return additionalPart
            + `${query}=${url}.indexOf('?',${exactHostLen});`
            + `${requestObjectName}.path=${query}===-1?${url}.substring(${exactHostLen}):${url}.substring(${exactHostLen},${query});`;

    return additionalPart + `${query}=${url}.indexOf('?',${exactHostLen});if(${query}===-1)${query}=${url}.length;`;
}

/**
 * Build a fetch function from fetch metadata
 */
export function buildFetch(meta: FetchMeta): (req: Request) => any {
    return Function(...meta.params, meta.body)(...meta.values);
}

export default Router;
export { Radx, composeRouter as compose };
