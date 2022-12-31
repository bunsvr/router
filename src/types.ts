import { AppRequest } from "@bunsvr/core";
import { Server } from "bun";
import { Methods, Pattern } from "trouter";

export interface HandlerFunction<App, RequestData = any> {
    /**
     * Run the route handler
     * @param this The current app
     * @param request The current request
     * @param server The current server
     * @param params The parsed params
     */
    (this: App, request: AppRequest<RequestData>, server: Server, params: Record<string, string>): Promise<any>;
}

export interface Handler<App, RequestData = any> {
    /**
     * Target request method
     */
    method: Methods | Methods[];

    /**
     * Target path
     */
    path: Pattern;

    /**
     * Run the route handler
     * @param this The current app
     * @param request The current request
     * @param server The current server
     */
    run: HandlerFunction<App, RequestData> | HandlerFunction<App, RequestData>[];
}