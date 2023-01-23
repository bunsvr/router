import { AppRequest } from "@bunsvr/core";
import { Server } from "bun";
import { App as CoreApp } from "@bunsvr/core";

/**
 * A route handler function
 */
export interface HandlerFunction<RequestData = any, App extends CoreApp = CoreApp> {
    /**
     * Run the route handler
     * @param this The current app
     * @param request The current request
     * @param server The current server
     * @param params The parsed params
     */
    (this: App, request: AppRequest<RequestData>, server: Server): Promise<any> | any;
}