import { Methods } from "trouter";
import { App as CoreApp } from "@bunsvr/core";
import { Handler, HandlerFunction } from "./types";
import Trouter from "trouter";

/**
 * A Bunsvr router
 */
class Router<App extends CoreApp, RequestData> {
    /**
     * @param app Target app
     * @param handlers Handlers
     */
    constructor(private readonly handlers: Handler<App, RequestData>[] = []) {
    }

    /**
     * Add a route handler
     * @param handler 
     */
    use(handler: Handler<App, RequestData>) {
        if (!Array.isArray(handler.run))
            handler.run = [handler.run];
        if (!Array.isArray(handler.method))
            handler.method = [handler.method];

        this.handlers.push(handler);
    }

    /**
     * Register the router as a middleware of the app
     */
    register(app: App) {
        // Normalize Base URI
        if (app.baseURI.endsWith("/"))
            app.baseURI = app.baseURI = app.baseURI.substring(0, app.baseURI.length - 1);

        // Add to Trouter
        const routes = new Trouter();     
        
        for (const handler of this.handlers) {
            // Bind all handler functions to app object
            const fns = (handler.run as HandlerFunction<App, RequestData>[]).map(f => f.bind(app));

            // No method provided
            if (!handler.method[0])
                handler.method = [""] as any;

            // Method provided
            for (const method of handler.method) 
                routes.add(method as Methods, handler.path, ...fns);
        }

        // Use as a middleware
        app.use(async (request, server) => {
            const list = routes.find(request.method as Methods, request.url.replace(app.baseURI, ""));
            let res: Response;

            for (const handler of list.handlers)
                /** @ts-ignore */
                if (res = await handler(request, server, list.params))
                    return res;
        });
    }
}

export { Router };
export * from "./types";