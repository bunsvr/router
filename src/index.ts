import { AppRequest, App as CoreApp } from "@bunsvr/core";
import { ServeOptions, Server, serve } from "bun";
import { HandlerFunction } from "./types";
import { pathToRegexp } from "path-to-regexp";

const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

/**
 * A BunSVR router
 * 
 * Note: This will run *only* the first route found
 */
class Router<RequestData = any, App extends CoreApp = CoreApp> {
    private statics: Record<string, HandlerFunction<RequestData, App>>;
    private regexs: [RegExp, HandlerFunction<RequestData, App>][];

    /**
     * Initialize a router
     */
    constructor() {
        this.statics = {};
        this.regexs = [];
    }

    /**
     * Register a static route
     * @param method The request method.
     * @param path The request pathname
     * @param handlers Route handlers
     */
    static(method: string | string[], path: string, handler: HandlerFunction<RequestData, App>): Router;

    /**
    * Register a static route that matches all request methods
    * @param path The request pathname
    * @param handlers Route handlers
    */
    static(path: string, handler: HandlerFunction<RequestData, App>): Router;

    static(...args: any[]) {
        // Ignore when arguments length is smaller than two
        if (args.length < 2)
            return this;
        // Register a static route that matches all request methods
        if (args.length === 2)
            return this.static("", args[0], args[1]);

        // With 3 arguments
        let [method, path, handler] = args;

        if (!Array.isArray(method))
            method = [method];

        for (const m of method)
            this.statics[m + path] = handler;

        return this;
    }

    /**
     * Register a dynamic route
     * @param method The request method.
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(method: string | string[], path: string | RegExp, handler: HandlerFunction<RequestData, App>): Router;

    /**
     * Register a dynamic route that matches all request methods
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(path: string | RegExp, handler: HandlerFunction<RequestData, App>): Router;
    /**
     * Register a dynamic route
     * @param method The request method.
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(...args: any[]) {
        // Ignore when arguments length is smaller than two
        if (args.length < 2)
            return this;

        // Register a static route that matches all request methods
        if (args.length === 2)
            return this.dynamic("", args[0], args[1]);

        // With 3 arguments
        let [method, path, handler] = args;

        if (!Array.isArray(method))
            method = [method];

        for (const m of method) {
            const regex = typeof path === "string"
                ? pathToRegexp(m + path)
                // Begins with method and ends with path
                : new RegExp(m + path.source);
            this.regexs.push([regex, handler]);
        }

        return this;
    }

    /**
     * Get the fetch handler of the router
     * @param fallback a fallback when no handler of a path is found
     * @returns the fetch handler
     */
    fetch(fallback?: (req: AppRequest, server: Server) => any | Promise<any>) {
        return async (req: AppRequest, server: Server) => {
            const path = urlSlicer.exec(req.url)[1],
                search = req.method + path;

            let route = this.statics[search] || this.statics[path];
            if (route)
                /** @ts-ignore */
                return route(req, server);

            for (const [reg, fn] of this.regexs)
                if (req.params = reg.exec(search) || reg.exec(path))
                    /** @ts-ignore */
                    return fn(req, server);

            return fallback 
                ? fallback(req, server) 
                : new Response("", { status: 404 });;
        }
    }

    /**
     * Register the router as a middleware of an app
     * @param app The target app
     */
    bind(app: App) {
        // Bind all handler to the app
        for (const key in this.statics)
            this.statics[key] = this.statics[key].bind(app);

        for (let i = 0; i < this.regexs.length; ++i)
            this.regexs[i][1] = this.regexs[i][1].bind(app);

        // App should handle 404 
        app.use(this.fetch());

        return app;
    }

    /**
     * Serve the router
     * @param opts Serve options
     */
    serve(opts?: Partial<ServeOptions & {
        fallback?: (req: Request, server: Server) => Response | Promise<Response>
    }>) {
        if (!opts)
            opts = {};

        opts.fetch = this.fetch(opts.fallback);

        return serve(opts as any);
    }
}

export { Router };
export * from "./types";
