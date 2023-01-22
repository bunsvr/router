import { HandlerFunction } from "./types";
import { App as CoreApp } from "@bunsvr/core";
import { pathToRegexp } from "path-to-regexp";

interface Route<App extends CoreApp, RequestData> {
    handlers: HandlerFunction<App, RequestData>[];
    method: string;
}

const requestMethods = "(" + [
    "GET", "HEAD", "POST", 
    "PUT", "DELETE", "CONNECT", 
    "OPTIONS", "TRACE", "PATCH"
].join("|") + ")";

const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

class Fouter<App extends CoreApp = CoreApp, RequestData = any> {
    static: Record<string, Route<App, RequestData>>;
    regexp: Map<RegExp, Route<App, RequestData>>;

    staticRoutes: Record<string, HandlerFunction<App, RequestData>[]>;
    regexRoutes: Map<RegExp, HandlerFunction<App, RequestData>[]>;

    constructor() {
        this.static = {};
        this.regexp = new Map;
    }

    add(method: string, path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        this.static[path] = { handlers, method };
    }

    match(method: string, path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        this.regexp.set(pathToRegexp(path, undefined, {
            start: false,
            end: false,
        }), {
            method, handlers
        });
    }

    /**
     * @param method 
     * @param path This path is a full URL
     */
    find(method: string, path: string) {
        // Remove query
        path = path.match(urlSlicer)[1];

        const search = method + path;
        const staticRoute = this.staticRoutes[search] || this.staticRoutes[path];
        if (staticRoute)
            return {
                params: [path],
                handlers: staticRoute
            };

        for (const [regex, o] of this.regexRoutes.entries()) {
            const res = regex.exec(search);

            if (res)
                return {
                    params: res,
                    handlers: o
                }
        }
    }

    /**
     * Remove this in future versions
     */
    setup() {
        this.staticRoutes = {};

        for (const key in this.static)
            this.staticRoutes[this.static[key].method + key] = this.static[key].handlers;

        this.regexRoutes = new Map;

        for (const regex of this.regexp.keys()) {
            const method = this.regexp.get(regex).method || requestMethods;
        
            this.regexRoutes.set(
                new RegExp("^" + method + regex.source + "$"),
                this.regexp.get(regex).handlers
            );
        }
    }

    bind(app: App) {
        for (const key in this.static)
            this.static[key].handlers = this.static[key].handlers.map(
                h => h.bind(app)
            );

        for (const key of this.regexp.keys()) {
            const oldHandlers = this.regexp.get(key);
            oldHandlers.handlers = oldHandlers.handlers.map(
                h => h.bind(app)
            )
            this.regexp.set(key, oldHandlers);
        }
    }
}

export default Fouter;