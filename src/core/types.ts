import type { Server, Errorlike } from 'bun';

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

type ParserType<B extends BodyParser> = B extends 'text' ? string : (
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
export interface WSContext<P extends string = string, I extends Dict<any> = never> {
    ctx: Context<'none', P>;
    store: Check<I>;
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
export interface Context<D extends BodyParser = 'none', P extends string = string> extends Request {
    /**
     * Parsed request body
     */
    data: ParserType<D>;
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
     * Set your custom heading here for response.
     *
     * This should be used with `guard` to add custom headers.
     */
    head: ContextHeaders;
    /**
     * The current server. Only usable when `opts.server` is set to `true`.
     */
    server: Server;
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
export interface Handler<
    T extends string = any,
    I extends Dict<any> = any,
    B extends BodyParser = any> extends RouteOptions {
    /**
     * @param request The current request
     */
    (ctx: Context<B, T>, store: Check<I>): any;
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

/**
 * Concat path
 */
export type ConcatPath<A extends string, B extends string> = `${A extends `${infer C}/` ? C : A}${B}`;

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

import {
    ServeOptions as BasicServeOptions, TLSServeOptions, TLSWebSocketServeOptions, WebSocketServeOptions
} from 'bun';

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
     * Whether to access `req.server`
     */
    server?: boolean;

    /**
     * Whether to use the handler as macro
     */
    macro?: boolean;
}

// Behave like a post middleware
export interface Wrapper {
    (response: any): any;
}
