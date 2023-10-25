import type { Server, WebSocketHandler } from 'bun';
import type { PluginObject, Router, RouterMeta } from '..';
import { wsHandlerDataKey } from '../core/router/compiler/constants';

export namespace ws {
    /**
     * Create a dynamic websocket route.
     */
    export function route<T = undefined>(handler: WebSocketHandler<T>, noOptions: boolean = false) {
        return new Route(handler, noOptions);
    }

    export interface Route<T = undefined> {
        /**
         * Upgrade the connection to a WebSocket connection.
         * User after attaching the route to a server
         */
        upgrade(c: Request, opts?: {
            /**
             * Send any additional headers while upgrading, like cookies
             */
            headers?: HeadersInit;

            /**
             * This value is passed to the {@link ServerWebSocket.data} property
             */
            data?: T;
        }): boolean;

        /**
         * The attached server
         */
        readonly server: Server;

        /**
         * The attached meta. Only works with Stric plugins
         */
        readonly meta: RouterMeta;
    }

    export class Route<T> implements PluginObject {
        constructor(public readonly handler: WebSocketHandler<T>, public noOptions: boolean = false) { }

        /**
         * Attach this route to a server
         */
        attach(server: Server) {
            const defOpts = {
                data: { [wsHandlerDataKey]: this.handler }
            };

            this.upgrade = this.noOptions
                ? (c: Request) => server.upgrade(c, defOpts)
                : Function('k', 's', `var i=k.data,h=i.${wsHandlerDataKey};`
                    + `return (c,o)=>{`
                    + `if('data'in o)o.data.${wsHandlerDataKey}=h;`
                    + `else o.data=i;`
                    + `return s.upgrade(c,o)}`
                )(defOpts, server);

            // @ts-ignore
            this.server = server;

            return this;
        }

        /**
         * This plugin runs after listening
         */
        plugin(app: Router) {
            if (app.details.server === null)
                throw new Error('This plugin needs to be registered after the server started!');

            this.attach(app.details.server);
            // @ts-ignore
            this.meta = app.details;
            return app;
        }
    }
}
