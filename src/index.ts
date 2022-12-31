import RouteFinder, { Methods } from "trouter";
import { App as CoreApp } from "@bunsvr/core";
import { Handler, HandlerFunction } from "./types";

/**
 * A Bunsvr router
 */
class Router<App extends CoreApp, RequestData> {
    /**
     * @param app Target app
     * @param routes A router of "trouter"
     */
    constructor(public readonly app: App, private readonly routes: RouteFinder<HandlerFunction<App, RequestData>> = new RouteFinder<HandlerFunction<App, RequestData>>()) {
        if (app.baseURI.endsWith("/"))
            this.app.baseURI = app.baseURI = app.baseURI.substring(0, app.baseURI.length - 1);
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

        const f = handler.run.map(h => h.bind(this.app));

        for (const method of handler.method)
            this.routes.add(method, handler.path, ...f);
    }

    /**
     * Register the router as a middleware of the app
     */
    register() {
        this.app.use(async (request, server) => {
            const list = this.routes.find(request.method as Methods, request.url.replace(this.app.baseURI, ""));
            let res: Response;

            for (const handler of list.handlers)
                /** @ts-ignore */
                if (res = await handler(request, server, list.params))
                    return res;
        });
    }
}

export { Router };