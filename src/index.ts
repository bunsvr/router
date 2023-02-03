import { App } from "@stricjs/core";
import { ServeOptions, Server, serve } from "bun";
import { Handler } from "./types";
import { pathToRegexp } from "path-to-regexp";

const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

/**
 * A BunSVR router
 * 
 * Note: This will run *only* the first route found
 */
class Router<T = any> {
    private statics: Record<string, Handler<T>>;
    private regexs: Record<string, {
        [method: string]: Handler<T>
    }>;

    /**
     * Initialize a router
     */
    constructor() {
        this.statics = {};
        this.regexs = {};
    }

    /**
     * Register a static route
     * @param method The request method.
     * @param path The request pathname
     * @param handlers Route handlers
     */
    static(method: string | string[], path: string, handler: Handler<T>): Router;

    /**
    * Register a static route that matches all request methods
    * @param path The request pathname
    * @param handlers Route handlers
    */
    static(path: string, handler: Handler<T>): Router;

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
    dynamic(method: string | string[], path: string | RegExp, handler: Handler<T>): Router;

    /**
     * Register a dynamic route that matches all request methods
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(path: string | RegExp, handler: Handler<T>): Router;
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
            const regex = (
                typeof path === "string"
                    ? pathToRegexp(path)
                    // Begins with method and ends with path
                    : new RegExp(path.source)
            ).source;

            this.regexs[regex] ||= {};
            Object.assign(this.regexs[regex], {
                [m]: handler
            });
        }

        return this;
    }

    /**
     * Get the fetch handler of the router
     * @returns the fetch handler
     */
    fetch() {
        const regexs: [RegExp, {
            [method: string]: Handler<T>
        }][] = [];

        for (const key in this.regexs)
            regexs.push([new RegExp(key), this.regexs[key]]);

        return (req: Request, server: Server) => {
            /** @ts-ignore */
            req.path ||= urlSlicer.exec(req.url)[1];

            let route = this.statics[req.method + req.path] || this.statics[req.path];
            if (route)
                /** @ts-ignore */
                return route(req, server);

            for (const [reg, fn] of regexs)
                if (
                    /** @ts-ignore */
                    (req.params = reg.exec(req.path))
                    && (route = fn[req.method])
                )
                    /** @ts-ignore */
                    return route(req, server);
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

        for (const key in this.regexs) {
            const val = this.regexs[key];
            for (const i in val)
                val[i] = val[i].bind(app);

            this.regexs[key] = val;
        }

        // App should handle 404 
        app.use(this.fetch());

        return app;
    }

    /**
     * Serve the router
     * @param opts Serve options
     */
    serve(opts?: Partial<ServeOptions>) {
        if (!opts)
            opts = {};

        opts.fetch = this.fetch();

        return serve(opts as any);
    }
}

export { Router };
export * from "./types";
