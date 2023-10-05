import { Router, RouterMethods, wrap } from "../core/main";
import type { ConcatPath, Handler, ResponseWrap, RouterPlugin, WSContext } from "../core/types";
import { convert, methodsLowerCase as methods } from "../core/constants";
import type { WebSocketHandler } from "bun";

export interface Group<R extends string> extends RouterMethods<R> { }

/**
 * A routes group. Can be used as a plugin
 */
export class Group<R extends string = '/'> {
    private record: any[][] = [];
    private wsRecord: any[][] = [];
    private plugins: any[] = [];

    /**
     * Handle WebSocket
     */
    ws<D extends Dict<any> = {}, T extends string = string>(path: T, handler: WebSocketHandler<WSContext<ConcatPath<R, T>> & D>) {
        // @ts-ignore
        path = convert(path);

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

        for (const method of methods) this[method] = (path: string, handler: Handler, opts: any) => {
            // Special cases
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
     * Wrap the response
     */
    wrap(path: string, handler: ResponseWrap = 'default') {
        if (typeof handler === 'string')
            handler = wrap[handler];

        if (this.root !== '/')
            path = this.root + path;
        path = convert(path);

        this.record.push(['WRAP', path, handler]);
        return this;
    }

    /**
     * Add a plugin
     * @param plugin 
     */
    plug(...plugins: RouterPlugin[]) {
        this.plugins.push(...plugins);
        return this;
    }

    private fixPath(p: string) {
        return this.root === '/' ? p : this.root + p;
    }

    /**
     * Get the plugin
     */
    plugin(app: Router) {
        let item: any;

        for (item of this.plugins) {
            if (item instanceof Group && this.root !== '/')
                // @ts-ignore
                item.root = this.root + item.root;

            app.plug(item);
        }

        for (item of this.record) app[item[0]](
            this.fixPath(item[1]), item[2]
        );

        for (item of this.wsRecord) app.ws(
            this.fixPath(item[0]), item[1]
        );
    }
}
