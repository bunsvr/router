import { Plugin, Router, RouterMethods } from "../core/main";
import { Handler } from "../core/types";
import { methodsLowerCase as methods } from "../core/constants";

export interface Group<I> extends RouterMethods<I> {}

/**
 * A routes group. Can be used as a plugin
 */
export class Group<I extends Dict<any> = Dict<any>> {
    private record: any[][];
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

        for (const method of methods) this[method] = (path: string, handler: Handler, opts: any) => {
            // Special cases
            if (this.root !== '/') path = this.root + path;
            if (path.at(-1) === '/') path = path.slice(0, -1);

            const args = [method, path, handler] as any[];
            if (opts) args.push(opts);

            this.record.push(args);
            return this;
        }
    }

    /**
     * Add a plugin
     * @param plugin 
     */
    plug(...plugins: Plugin[]) {
        this.plugins.push(...plugins);
        return this;
    }

    /**
     * Get the plugin
     */
    plugin(app: Router) {
        for (const item of this.record) app[item[0]](...item.slice(1));
        for (const item of this.plugins) app.plug(item);
    }
}
