import { Router, wrap } from "../core/main";
import type {
    ConcatPath, Handler, ResponseWrap, RouterPlugin,
    HttpMethod, BodyParser, RouteOptions
} from "../core/types";
import { convert, methodsLowerCase as methods } from "../core/constants";

export type GroupMethods<Root extends string> = {
    [K in HttpMethod]: <T extends string, O extends RouteOptions | string>(
        path: T, handler: O extends { body: infer B }
            ? (
                B extends BodyParser
                ? Handler<ConcatPath<Root, T>, B>
                : Handler<ConcatPath<Root, T>>
            ) : Handler<ConcatPath<Root, T>>,
        options?: O
    ) => Group<Root>;
};

export interface Group<Root extends string> extends GroupMethods<Root> { }

// @ts-ignore Shorthand
export const route: GroupMethods<'/'> = {};
for (const method of methods)
    route[method] = (...args: any[]) => new Group()[method](...args);

/**
 * A routes group. Can be used as a plugin
 */
export class Group<Root extends string = '/'> {
    record: any[][] = [];
    plugins: any[] = [];

    /**
     * Create a new routes group
     * @param root 
     */
    // @ts-ignore
    constructor(public root: Root = '/') {
        if (root !== '/' && root.endsWith('/'))
            // @ts-ignore
            root = root.slice(0, -1);
        this.root = root;

        for (const method of methods) this[method] = (path: string, handler: Handler, opts: any) => {
            // Special cases
            path = convert(path);

            const args = [method, path, handler];
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
    wrap(path: string, handler: ResponseWrap = 'plain') {
        if (typeof handler === 'string')
            handler = wrap[handler];

        if (this.root !== '/')
            path = this.root + path;
        path = convert(path);

        this.record.push(['wrap', path, handler]);
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
            // Set the correct root
            if (item instanceof Group) {
                if (item.root === '/')
                    item.root = this.root;
                else if (this.root !== '/')
                    // @ts-ignore
                    item.root = this.root + item.root;
            }

            app.plug(item);
        }

        for (item of this.record) app[item[0]](
            this.fixPath(item[1]), ...item.slice(2)
        );
    }
}
