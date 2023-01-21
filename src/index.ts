import { Methods } from "trouter";
import { App as CoreApp } from "@bunsvr/core";
import { Handler, HandlerFunction } from "./types";
import Trouter from "trouter";
import { ServeOptions, Server } from "bun";

function routeFrom<App extends CoreApp, RequestData>(handlers: Handler<App, RequestData>[], app?: App) {
    // Add to Trouter
    const routes = new Trouter();     
        
    for (const handler of handlers) {
        // Bind all handler functions to app object
        let fns = (handler.run as HandlerFunction<App, RequestData>[])
        if (app)
            fns = fns.map(f => f.bind(app));

        // No method provided
        if (!handler.method[0])
            handler.method = [""] as any;

        // Method provided
        for (const method of handler.method) 
            routes.add(method as Methods, handler.path, ...fns);
    }

    return routes;
}


function handlerFrom(routes: Trouter, splitLen: number) {
    return async (request: Request, server: Server) => {
        const list = routes.find(request.method as Methods, request.url.slice(splitLen));
        let res: Response;

        for (const handler of list.handlers)
            /** @ts-ignore */
            if (res = await handler(request, server, list.params))
                return res;
    }
}

/**
 * A Bunsvr router
 */
class Router<App extends CoreApp, RequestData> {
    /**
     * @param app Target app
     * @param handlers Handlers
     */
    constructor(private readonly handlers: Handler<App, RequestData>[] = []) {}

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
        const routes = routeFrom(this.handlers, app);
        const trailLen = app.baseURI.length;

        // Use as a middleware
        app.use(handlerFrom(routes, trailLen));
    }

    /**
     * Directly serve an app
     * 
     * App need to have a correctly formatted baseURI (without trailing "/")
     * @example http://localhost:3000
     * @param app 
     */
    serve(app?: Partial<ServeOptions>) {
        if (!app)
            app = {};
        if (!app.baseURI)
            app.baseURI = "http://localhost:3000";

        const routes = routeFrom(this.handlers);
        const trailLen = app.baseURI.length;
        
        app.fetch = handlerFrom(routes, trailLen);

        return Bun.serve(app as ServeOptions);
    }
}

export { Router };
export * from "./types";