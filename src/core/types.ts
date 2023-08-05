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
                B extends 'blob' ? Blob : never
            ) 
        )
    )
);

/**
 * A route handler function
 */
export interface Handler<T extends string = string, I extends Dict<any> = {}, B extends BodyParser = any> {
    /**
     * @param request The current request
     */
    (request: Request<Params<T>, ParserType<B>>, store: Check<I>): any;
}

// Override 
declare global {
    interface Request<T = any, B = any> {
        /**
         * Parsed request body
         */
        data: B;
        /**
         * Parsed request parameter with additional properties if specified
         */
        params: T;
        /**
         * Request query start index (include `?`).
         */
        query: number;

        /**
         * The parsed request path. 
         * Example: `http://localhost:3000/id/90` -> `id/90`
         */
        path: string;
    }

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
