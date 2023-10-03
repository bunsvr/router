import type { Server, Errorlike } from 'bun';
import {
    ServeOptions as BasicServeOptions, TLSServeOptions,
    TLSWebSocketServeOptions, WebSocketServeOptions
} from 'bun';
import { jsonHeader } from './router/compiler/constants';
import type Router from './main';

const { stringify } = JSON, badReq = { status: 400 };

export const wrap = {
    /**
     * Wrap the response 
     */
    default: (d: ResponseBody) => new Response(d),
    /**
     * Wrap the JSON response with `Response.json`
     */
    json: (d: any) => new Response(stringify(d), jsonHeader),
    /**
     * Send all info in ctx
     */
    send: (d: ResponseBody, ctx: Context) => 'set' in ctx
        ? new Response('body' in ctx.set ? ctx.set.body : d, ctx.set)
        : new Response(d),
    /**
     * Send all info in ctx and the response as json
     */
    sendJSON: (d: any, ctx: Context) => d === null
        ? new Response(null, badReq)
        : ('set' in ctx
            ? new Response('body' in ctx.set ? stringify(ctx.set.body) : stringify(d), ctx.set)
            : new Response(stringify(d), jsonHeader)
        ),
};

type Check<T> = keyof T extends never ? undefined : T;
type ExtractParams<T extends string> = T extends `${infer Segment}/${infer Rest}`
    ? (Segment extends `:${infer Param}`
        ? (Rest extends `*` ? { [K in Param]: string } : { [K in Param]: string } & ExtractParams<Rest>)
        : {}) & ExtractParams<Rest>
    : T extends `:${infer Param}`
    ? { [K in Param]: string }
    : T extends `*`
    ? { '*': string }
    : {};

/**
 * Infer params from string
 */
export type Params<P extends string, E extends object = {}> = Check<ExtractParams<P> & E>;

export type ParserType<B extends BodyParser> = B extends 'text' ? string : (
    B extends 'json' ? Record<string | number, any> : (
        B extends 'form' ? FormData : (
            B extends 'buffer' ? ArrayBuffer : (
                B extends 'blob' ? Blob : any
            )
        )
    )
);

/**
 * WebSocket data
 */
export interface WSContext<P extends string = string> {
    /**
     * The current context
     */
    ctx: Context<'none', P>;
    /**
     * The router meta
     */
    meta: RouterMeta;
}

/**
 * All common headers name
 */
export type CommonHeader = "Content-Type" | "Authorization" | "User-Agent"
    | "Access-Control-Allow-Origin" | "Access-Control-Max-Age" | "Access-Control-Allow-Headers"
    | "Access-Control-Allow-Credentials" | "Access-Control-Expose-Headers" | "Vary" | "Accept"
    | "Accept-Encoding" | "Accept-Language" | "Connection" | "Cache-Control" | "Set-Cookie" | "Cookie"
    | "Referer" | "Content-Length" | "Date" | "Expect" | "Server" | "Location" | "If-Modified-Since" | "ETag"
    | "X-XSS-Protection" | "X-Content-Type-Options" | "Referrer-Policy" | "Expect-CT" | "Content-Security-Policy"
    | "Cross-Origin-Opener-Policy" | "Cross-Origin-Embedder-Policy" | "Cross-Origin-Resource-Policy"
    | "Permissions-Policy" | "X-Powered-By" | "X-DNS-Prefetch-Control" | "Public-Key-Pins"
    | "X-Frame-Options" | "Strict-Transport-Security";

export type CommonHeaders = {
    [head in CommonHeader]?: string;
}

/**
 * Represent a `head` object
 */
export interface ContextHeaders extends CommonHeaders, Dict<string> { };

/**
 * Represent a request context
 */
export interface Context<D = any, P extends string = string> extends Request {
    /**
     * Parsed request body
     */
    data: D;
    /**
     * Parsed request parameter with additional properties if specified
     */
    params: Params<P> & Dict<any>;
    /**
     * Request query start index (include `?`).
     */
    query: number;
    /**
     * Request path start index (skip first `/`).
     * This field only exists only if `base` is not specified
     */
    path: number;
    /**
     * Use to set response
     */
    set: ContextSet;
}

export interface ContextSet extends ResponseInit {
    /**
     * Set your custom heading here for response.
     *
     * This should be used with `guard` and `wrap` to add custom headers.
     */
    headers?: ContextHeaders;
    /**
     * Set a response to be used or validate later
     */
    body?: any;
}

/**
 * Blob part
 */
export type BlobPart = string | Blob | BufferSource;

/**
 * A Response body 
 */
export type ResponseBody = ReadableStream<any> | BlobPart | BlobPart[] | FormData | URLSearchParams;

/**
 * A route handler function
 */
export interface Handler<T extends string = any, B extends BodyParser = any> extends RouteOptions {
    (ctx: Context<ParserType<B>, T>, meta: RouterMeta): any;
}

export interface RouterMeta {
    /**
     * Whether the server is using HTTPS 
     */
    https: boolean;
    /**
     * The base URL with protocol and base host
     */
    base: string;
    /**
     * The base host 
     */
    host: string;
    /**
     * Whether the server is using default port 
     */
    defaultPort: boolean;
    /**
     * The debug server
     */
    server: Server;
    /**
     * The router 
     */
    router: Router;
    /**
     * Whether server is in dev mode
     */
    dev: boolean;
}


/**
 * Builtin body parser 
 * - 'json': req.json()
 * - 'text': req.text()
 * - 'form': req.formData()
 * - 'blob': req.blob()
 * - 'buffer': req.arrayBuffer()
 */
export type BodyParser = 'json' | 'text' | 'form' | 'blob' | 'buffer' | 'none';

type TrimEndPath<P extends string> = P extends `${infer C}/` ? C : P;
type AddStartPath<P extends string> = P extends `/${infer C}` ? `/${C}` : `/${P}`;

/**
 * Normalize a path
 */
export type Normalize<P extends string> = TrimEndPath<AddStartPath<P>> extends '' ? '/' : TrimEndPath<AddStartPath<P>>;

/**
 * Concat path
 */
export type ConcatPath<A extends string, B extends string> = Normalize<`${Normalize<A>}${Normalize<B>}`>;

/**
 * Fetch metadatas
 */
export interface FetchMeta {
    /**
     * Parameters to pass into fetch scope
     */
    params: string[];

    /**
     * The body of the fetch function 
     */
    body: string;

    /**
     * All values corresponding to the parameters
     */
    values: any[];
}

interface AllOptions extends BasicServeOptions, TLSServeOptions, WebSocketServeOptions, TLSWebSocketServeOptions { }

export interface ServeOptions extends Partial<AllOptions> {
    /**
     * Enable inspect mode
     */
    inspector?: boolean;

    /**
     * Should be set to something like `http://localhost:3000`
     * This enables optimizations for path parsing but does not work with subdomain
     */
    base?: string;

    /**
     * The minimum length of the request domain.
     *
     * Use this instead of `base` to work with subdomain
     */
    uriLen?: number;
}

/**
 * An error handler
 */
export interface ErrorHandler {
    (this: Server, err: Errorlike): any
}

/**
 * Handle body parsing error
 */
export interface BodyHandler {
    (err: any, ...args: Parameters<Handler>): any;
}

export interface RouteOptions {
    /**
     * Select a body parser
     */
    body?: BodyParser;

    /**
     * Whether to use the handler as macro
     */
    macro?: boolean;

    /**
     * Specify a wrapper.
     * If set to false, the parent wrapper will be disabled
     */
    wrap?: Wrapper | keyof typeof wrap | true | false;

    /**
     * Whether to chain wrap with `then`
     */
    chain?: boolean;
}

// Behave like a post middleware
export interface Wrapper {
    (response: any, ...args: Parameters<Handler>): any;

    // Private props for modifying at compile time
    callName?: string;
    params?: string;
    hasParams?: boolean;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch' | 'all' | 'guard' | 'reject';
export type RouterMethods<R extends string> = {
    [K in HttpMethod]: <T extends string, O extends RouteOptions>(
        path: T, handler: O extends { body: infer B }
            ? (
                B extends BodyParser
                ? Handler<ConcatPath<R, T>, B>
                : Handler<ConcatPath<R, T>>
            ) : Handler<ConcatPath<R, T>>,
        options?: O
    ) => Router;
};

/**
 * Specific plugin for router
 */
export interface Plugin {
    (app: Router): Router | void | Promise<Router | void>
}
