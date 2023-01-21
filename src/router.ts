import { HandlerFunction } from "./types";
import { App as CoreApp } from "@bunsvr/core";
import { parse, pathToRegexp, Key } from "path-to-regexp";

interface Route<App extends CoreApp, RequestData> {
    handlers: HandlerFunction<App, RequestData>[];
    method?: string;
}

class Fouter<App extends CoreApp = CoreApp, RequestData = any> {
    static: Record<string, Route<App, RequestData>>;
    regexp: Map<RegExp, Route<App, RequestData>>;

    staticRoutes: Record<string, Route<App, RequestData>>;
    regexRoutes: Map<RegExp, Route<App, RequestData>>;

    constructor() {
        this.static = {};
        this.regexp = new Map;
    }

    add(method: string, path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        this.static[path + method] = { handlers };
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
        let index = path.lastIndexOf("?");
        if (index > -1)
            path = path.slice(0, index);

        const staticRoute = this.staticRoutes[path + method] || this.staticRoutes[path];
        if (!staticRoute) {
            for (const [regex, o] of this.regexRoutes.entries()) {
                const res = regex.exec(path);
                if (res && o.method === method) 
                    return {
                        params: res,
                        handlers: o.handlers
                    }
            }

            return;
        }
        
        return {
            params: [path],
            handlers: staticRoute.handlers
        };
    }

    setBase(uri: string) {
        const reg = new RegExp("^" + uri);

        this.staticRoutes = {};

        for (const key in this.static) 
            this.staticRoutes[uri + key] = this.static[key];

        this.regexRoutes = new Map;

        for (const regex of this.regexp.keys()) 
            this.regexRoutes.set(
                new RegExp(reg.source + regex.source + "$"), 
                this.regexp.get(regex)
            );
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