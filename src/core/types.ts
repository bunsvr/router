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
    ctx: Context<P>;
    store: Check<I>;
}

/**
 * Represent a request context
 */
export interface Context<P extends string = string, D extends BodyParser = 'none'> extends Request {
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
     * Request path start index (skip first `/`)
     */
    path: number;
}

/**
 * A route handler function
 */
export interface Handler<T extends string = string, I extends Dict<any> = {}, B extends BodyParser = any> {
    /**
     * @param request The current request
     */
    (ctx: Context<T, B>, store: Check<I>): any;
}

// Override 
declare global {
    /**
     * The current running server. Only usable when app is run with `ls()`
     */
    var server: import('bun').Server;
};

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
