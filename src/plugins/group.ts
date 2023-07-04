import { Plugin, Router } from "../core/main";
import { Handler } from "../core/types";

const methods = ["get", "head", "post", "put", "delete", "connect", "options", "trace", "patch"];

/**
 * A routes group. Can be used as a plugin
 */
export class Group {
    private record: [method: string, path: string, handler: Handler][];
    private plugins: Plugin[];

    /**
     * Create a new routes group
     * @param root 
     */
    constructor(public readonly root: string = '/') {
        if (root !== '/' && root.endsWith('/'))
            root = root.slice(0, -1);
        this.root = root;
        this.record = [];
        this.plugins = [];

        for (const method of methods) {
            const METHOD = method.toUpperCase();
            this[method] = (path: string, handler: Handler) => {
                // Special cases
                if (this.root !== '/') path = this.root + path;

                this.record.push([METHOD, path, handler]);
                return this;
            }
        }
    }

    /**
     * Add a plugin
     * @param plugin 
     */
    plug(plugin: Plugin) {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Get the plugin
     */
    plugin(app: Router) {
        for (const item of this.record)
            app.use(...item);
        for (const item of this.plugins)    
            app.plug(item);
    }

    /**
     * Add a GET method handler to the router 
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    get<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a HEAD method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    head<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a POST method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    post<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a PUT method handler to the router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    put<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a DELETE method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    delete<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a CONNECT method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    connect<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a OPTIONS method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    options<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a TRACE method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    trace<T extends string>(path: T, handler: Handler<T>): this;

    /**
     * Add a PATCH method handler to tne router
     * @param path 
     * @param handler 
     */
    // @ts-ignore
    patch<T extends string>(path: T, handler: Handler<T>): this;
}