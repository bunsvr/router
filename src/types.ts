import { Server } from "bun";
import { App } from "@stricjs/core";

/**
 * A route handler function
 */
export interface Handler<T = any> {
    /**
     * Run the route handler
     * @param this The current app
     * @param request The current request
     * @param server The current server
     * @param params The parsed params
     */
    (this: App, request: Request<T>, server: Server): any;
}

// Override 
declare global {
    interface Request<T = any> {
        /**
         * Parsed URL parameters. Only usable with RegExp routes.
         */
        readonly params: string[];

        /**
         * Request pathname
         */
        readonly path: string;

        /**
         * Data object to store some vars through middlewares
         */
        data?: T;
    }
}