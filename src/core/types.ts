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

/**
 * A route handler function
 */
export interface Handler<T extends string = string> {
    /**
     * @param request The current request
     */
    (request: Request<Params<T>>): any;
}

// Override 
declare global {
    interface Request<T = any> {
        /**
         * Injected dependencies
         */
        readonly inject: Record<string, any>;
        /**
         * Parsed request parameter with additional properties if specified
         */
        readonly params: T;
        /**
         * Request query start index (include `?`).
         */
        readonly query: number;

        /**
         * The parsed request path. 
         * Example: `http://localhost:3000/id/90` -> `id/90`
         */
        readonly path: string;
    }

    /**
     * The current running server. Only usable when app is run with `ls()`
     */
    var server: import('bun').Server;
}

export type StaticRoute = {
    [path: string]: {
        [method: string]: Handler | number
    }
};
