import { HandlerFunction } from "./types";
import { App as CoreApp } from "@bunsvr/core";
import { parse, pathToRegexp, Key } from "path-to-regexp";

interface Route<App extends CoreApp, RequestData> {
    handlers: HandlerFunction<App, RequestData>[];
    method?: string;
    tokens?: string[];
}

class Fouter<App extends CoreApp = CoreApp, RequestData = any> {
    static: Record<string, Route<App, RequestData>>;
    regexp: Map<RegExp, Route<App, RequestData>>;

    staticRoutes: Record<string, Route<App, RequestData>>;
    regexRoutes: Map<RegExp, Route<App, RequestData>>;

    // Pre-calculate keys
    regexRoutesKeys: IterableIterator<RegExp>;

    constructor() {
        this.static = {};
        this.regexp = new Map;
    }

    add(method: string, path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        if (!path || path === "/")
            path = "";

        this.static[path + method] = { handlers };
    }

    match(method: string, path: string, ...handlers: HandlerFunction<App, RequestData>[]) {
        const toks = parse(path);
        toks.shift();

        this.regexp.set(pathToRegexp(path, undefined, {
            start: false,
            end: false,
        }), {
            method, handlers, tokens: toks.map(
                v => String((v as Key).name)
            )
        });
    }

    /**
     * @param method 
     * @param path This path is a full URL
     */
    find(method: string, path: string) {
        const staticRoute = this.staticRoutes[path + method] || this.staticRoutes[path];
        if (!staticRoute) {
            for (const regex of this.regexRoutesKeys) {
                const res = regex.exec(path);
                if (res) {
                    const current = this.regexRoutes.get(regex);

                    const o = {};
                    for (let i = 0; i < current.tokens.length; ++i)
                        o[current.tokens[i]] = res[i + 1];

                    return {
                        params: o,
                        handlers: current.handlers
                    }
                }
            }

            return;
        }
        
        return {
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

        this.regexRoutesKeys = this.regexRoutes.keys();
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