import { App as CoreApp } from "@bunsvr/core";
import { ServeOptions, Server, serve } from "bun";
import Fouter from "./router";
import { HandlerFunction } from "./types";

/**
 * A BunSVR router
 * 
 * Note: This will run *only* the first route founded
 */
class Router<App extends CoreApp = CoreApp, RequestData = any> {
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
    static(method: string | string[], path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        if (typeof method === "string")
            method = [method];

        for (const m of method)
            this.router.add(m, path, ...handlers);
    }

    /**
     * Register a dynamic route
     * @param method The request method. "" means all request method
     * @param path The request pathname
     * @param handlers Route handlers
     */
    dynamic(method: string | string[], path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        if (typeof method === "string")
            method = [method];

        for (const m of method)
            this.router.match(m, path, ...handlers);
    }

    #cb() {
        return async (req: Request, server: Server) => {
            const o = this.router.find(req.method, req.url);
            if (!o?.handlers?.length)
                return;

            const hs = o.handlers as any[];

            if (hs.length === 1)
                return hs[0](req, server, o.params);
        
            let res: Response;
            for (const handler of hs)
                if (res = await handler(req, server, o.params))
                    return res;
        }
    }

    /**
     * Register the router as a middleware of an app
     * @param app The target app
     */
    register(app: App) {
        this.router.bind(app);
        this.router.setBase(app.baseURI);

        app.use(this.#cb());
    }

    /**
     * Serve the router
     * @param opts Serve options
     */
    serve(opts?: Partial<ServeOptions & { 
        protocol: "http" | "https", 
        fallback: (req: Request, server: Server) => Response | Promise<Response> 
    }>) {
        if (!opts)
            opts = {};
        if (!opts.baseURI)
            opts.baseURI = `${opts.protocol || "http"}://${opts.hostname || "localhost"}:${opts.port || 3000}`;
        if (!opts.fallback)
            opts.fallback = () => new Response("", {
                status: 404
            });

        this.router.setBase(opts.baseURI);

        opts.fetch = this.#cb();

        return serve(opts as any);
    }
}

export { Router };
export * from "./types";