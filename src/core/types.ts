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
     * @param this The current app
     * @param request The current request
     * @param server The current server
     * @param params The parsed params
     */
    (request: Request<Params<T>>): any;
}

// Override 
declare global {
    interface Request<T = any> {
        /**
         * Dependencies
         */
        readonly inject: Record<string, any>;
        /**
         * Parsed request parameter with additional properties if specified
         */
        readonly params: T;
        /**
         * Request pathname without query
         */
        readonly path: string;

        /**
         * Request query start index with the `?`.
         */
        readonly query: number;
    }
}

export type StaticRoute = {
    [path: string]: {
        [method: string]: Handler | number
    }
};

export interface RouteOptions {
    /**
     * Whether to parse query or not
     */
    parseQuery: boolean;
}
