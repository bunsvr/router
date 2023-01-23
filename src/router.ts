import { HandlerFunction } from "./types";
import { App as CoreApp } from "@bunsvr/core";
import { pathToRegexp } from "path-to-regexp";

const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

class Fouter<App extends CoreApp = CoreApp, RequestData = any> {
    static: Record<string, HandlerFunction<RequestData, App>>;
    regexp: [RegExp, HandlerFunction<RequestData, App>][];

    constructor() {
        this.static = {};
        this.regexp = [];
    }

    add(method: string, path: string, handler: HandlerFunction<RequestData, App>) {
        this.static[method + path] = handler;
    }

    match(method: string, path: string | RegExp, handler: HandlerFunction<RequestData, App>) {
        const regex = typeof path === "string"
            ? pathToRegexp(method + path)
            // Begins with method and ends with path
            : new RegExp(method + path.source);
        this.regexp.push([regex, handler]);
    }

    /**
     * @param method 
     * @param path This path is a full URL
     */
    find(method: string, path: string): [HandlerFunction<RequestData, App>?, string[]?] {
        // Remove query
        path = urlSlicer.exec(path)[1];
        const search = method + path;

        const staticRoute = this.static[search] || this.static[path];
        if (staticRoute)
            return [staticRoute];

        for (const [regex, o] of this.regexp) {
            const res = regex.exec(search) || regex.exec(path);

            if (res)
                return [o, res];
        }

        return [];
    }

    bind(app: App) {
        for (const key in this.static)
            this.static[key] = this.static[key].bind(app);

        for (let i = 0; i < this.regexp.length; ++i)
            this.regexp[i][1] = this.regexp[i][1].bind(app);
    }
}

export default Fouter;