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
     * @param method The request method. "" means all request method
     * @param path The request pathname
     * @param handlers Route handlers
     */
    static(method: string, path: string, handler: HandlerFunction<RequestData, App>) {
        this.statics[method + path] = handler;

        return this;
    }

    /**
     * Register a dynamic route
     * @param method The request method. "" means all request method
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(method: string, path: string | RegExp, handler: HandlerFunction<RequestData, App>) {
        const regex = typeof path === "string"
            ? pathToRegexp(method + path)
            // Begins with method and ends with path
            : new RegExp(method + path.source);
        this.regexs.push([regex, handler]);

        return this;
    }

    #cb(fallback: (req: AppRequest, server: Server) => any | Promise<any>) {
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

            return fallback(req, server);
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
        app.use(this.#cb(() => {}));

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
        if (!opts.fallback)
            opts.fallback = () => new Response("", {
                status: 404
            });

        opts.fetch = this.#cb(opts.fallback);

        return serve(opts as any);
    }
}

export { Router };
export * from "./types";