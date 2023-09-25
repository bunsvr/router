import { Router, RouterMethods, wrap } from "../core/main";
import type { ConcatPath, Handler, WSContext, Wrapper } from "../core/types";
import { convert, methodsLowerCase as methods } from "../core/constants";
import type { WebSocketHandler } from "bun";

export interface Group<R extends string> extends RouterMethods<R> { }

/**
 * A routes group. Can be used as a plugin
 */
export class Group<R extends string = '/'> {
    private record: any[][];
    private wsRecord: any[][];

    /**
     * Handle WebSocket
     */
    ws<D extends Dict<any> = {}, T extends string = string>(path: T, handler: WebSocketHandler<WSContext<ConcatPath<R, T>> & D>) {
        // Add a WebSocket handler
        this.wsRecord.push([path, handler]);
        return this;
    }

    /**
     * Create a new routes group
     * @param root 
     */
    // @ts-ignore
    constructor(public readonly root: R = '/') {
        if (root !== '/' && root.endsWith('/'))
            // @ts-ignore
            root = root.slice(0, -1);
        this.root = root;
        this.record = [];
        this.wsRecord = [];

        for (const method of methods) this[method] = (path: string, handler: Handler, opts: any) => {
            // Special cases
            if (this.root !== '/') path = this.root + path;
            path = convert(path);

            const args = [method, path, handler] as any[];
            if (opts) args.push(opts);

            this.record.push(args);
            return this;
        }
    }

    /**
     * Use the default response wrapper for a group of subroutes
     */
    wrap(path: string): this;

    /**
     * Add a response wrapper for a group of subroutes
     */
    wrap(path: string, type: keyof typeof wrap): this;

    /**
     * Add a custom response wrapper for a group of subroutes
     */
    wrap(path: string, fn: Wrapper): this;

    /**
     * Wrap the response
     */
    wrap(path: string, handler: Wrapper | keyof typeof wrap = 'default') {
        if (typeof handler === 'string')
            handler = wrap[handler];

        if (this.root !== '/')
            path = this.root + path;
        path = convert(path);

        this.record.push(['WRAP', path, handler]);
        return this;
    }

    /**
     * Get the plugin
     */
    plugin(app: Router) {
        for (const item of this.record) app[item[0]](...item.slice(1));
        for (const item of this.wsRecord) app.ws(item[0], item[1]);
    }
}
