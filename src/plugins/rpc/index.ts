import type { BodyParser, Handler, RouterMeta, Context, ParserType, Plugin } from "../..";
import { Group } from "../group";
import { requestObjectName } from "../../core/router/compiler/constants";
import { checkArgs } from "../../core/router/compiler/resolveArgs";
import client from "./client";

const badReq = { status: 400 };

export namespace rpc {
    export interface Router<T extends Dict<Procedure<any, any>>> {
        infer: T;
        plugin: Plugin,
        group: Group
    }

    export function router<T extends Dict<Procedure<any, any>>>(o: T, root: string = '/') {
        if (root.at(-1) !== '/') root += '/';
        const group = new Group;

        let key: string, handlerArgs: string,
            fnArgs: string, vld: any, fn: any;

        for (key in o) {
            vld = o[key].validator;
            fn = o[key].fn;

            // Init args for optimizations
            handlerArgs = checkArgs(fn, 0);

            // The handler args
            fnArgs = handlerArgs === '' ? requestObjectName : (
                handlerArgs.includes(',') ? '(' + handlerArgs + ')' : handlerArgs
            );

            // Pass in v for validator and f for the actual fn
            group.post(root + key, Function('v', 'f', 'h',
                `return ${fnArgs}=>`
                + `v(${requestObjectName}.data)===null?null`
                + `:f(${handlerArgs})`
            )(vld, fn, badReq), { body: 'json', wrap: 'sendJSON' });
        }

        return {
            infer: o, group,
            // A plug to plugin the RPC router directly
            plugin: group.plugin.bind(group)
        };
    }

    /**
     * A procedure validator
     */
    export interface Validator<D, T> {
        (d: D): T | null;
    }

    /**
     * Create a router procedure. You need to modify `c.data` in 
     * the validator to match the type (if needed).
     */
    export function proc<D extends BodyParser, T>(v: Validator<ParserType<D>, T>) {
        return new Procedure(v);
    }

    /**
     * A procedure handler
     */
    export interface ProcHandler<B, R> {
        (ctx: Context<B>, meta: RouterMeta): R;
    }

    export class Procedure<T, R> {
        public fn: Handler;

        // For infer types
        public fnReturnType: R;
        public validatorReturn: T;

        constructor(public readonly validator: Validator<ParserType<'json'>, T>) { }

        /**
         * Add a handler to the procedure
         */
        use<Q>(t: ProcHandler<T, Q>) {
            this.fn = t;
            // @ts-ignore
            return this as Procedure<T, Q>;
        }
    }

    /**
     * Infer type for RPC client
     */
    export type Infer<T extends Dict<Procedure<any, any>>> = {
        [K in keyof T]: (body: T[K]["validatorReturn"]) => Promise<T[K]["fnReturnType"]>;
    }

    /**
     * Create a RPC client
     */
    export declare function client<T extends Router<any>>(root: string): Infer<T['infer']>;
}

rpc.client = client;
