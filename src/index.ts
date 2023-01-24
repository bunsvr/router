import { AppRequest, App as CoreApp } from "@bunsvr/core";
import { ServeOptions, Server, serve } from "bun";
import Fouter from "./router";
import { HandlerFunction } from "./types";

/**
 * A BunSVR router
 * 
 * Note: This will run *only* the first route found
 */
class Router<RequestData = any, App extends CoreApp = CoreApp> {
    private readonly router: Fouter<App, RequestData>;

    constructor() {
        this.router = new Fouter();
    }

    /**
     * Register a static route
     * @param method The request method. "" means all request method
     * @param path The request pathname
     * @param handlers Route handlers
     */
    static(method: string | string[], path: string, handler: HandlerFunction<RequestData, App>) {
        if (typeof method === "string")
            method = [method];

        for (const m of method)
            this.router.add(m, path, handler);

        return this;
    }

    /**
     * Register a dynamic route
     * @param method The request method. "" means all request method
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(method: string | string[], path: string | RegExp, handler: HandlerFunction<RequestData, App>) {
        if (typeof method === "string")
            method = [method];

        for (const m of method)
            this.router.match(m, path, handler);

        return this;
    }

    #cb(fallback: (req: Request, server: Server) => any | Promise<any>) {
        return async (req: AppRequest, server: Server) => {
            const [handler, params] = this.router.find(req.method, req.url);
            if (handler) {
                req.params = params;
                /** @ts-ignore */
                return handler(req, server);
            }

            return fallback(req, server);
        }
    }

    /**
     * Register the router as a middleware of an app
     * @param app The target app
     */
    register(app: App) {
        this.router.bind(app);

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