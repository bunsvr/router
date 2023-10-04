import type { BodyParser, Handler, RouterMeta, Context, ParserType, Plugin, wrap, Wrapper } from "../..";
import { Group } from "../group";
import { compiler } from "../../core/main";
import { checkArgs } from "../../core/router/compiler/resolveArgs";
import client from "./client";

const badReq = { status: 400 };

export namespace rpc {
    export interface RouterProps<T extends Dict<Procedure>> {
        infer: T;
        plugin: Plugin,
        group: Group
    }

    /**
     * A procedure handler
     */
    export interface ProcHandler<B, R> {
        (ctx: Context<B>, meta: RouterMeta): R;
    }

    /**
     * Infer type for RPC client
     */
    export type Infer<T extends Dict<Procedure>> = {
        [K in keyof T]: {
            format(format: T[K]['format']): (body: T[K]['validatorReturn']) => Promise<T[K]['fnReturnType']>;
            (body: T[K]['validatorReturn']): Promise<T[K]['fnReturnType']>;
        }
    }


    /**
    * A procedure validator
    */
    export interface Validator<D, T> {
        (d: D): T | null;
    }

    // Create a RPC router
    export function route<T extends Dict<Procedure>>(o: T, root: string = '/') {
        if (root.at(-1) !== '/') root += '/';
        const group = new Group;

        let key: string, handlerArgs: string, routeOpts: any,
            fnArgs: string, vld: any, fn: any;

        for (key in o) {
            vld = o[key].validator;
            fn = o[key].fn;
            routeOpts = {
                body: o[key].format,
                wrap: o[key].wrapper
            };

            // Init args for optimizations
            handlerArgs = checkArgs(fn, 0);

            // The handler args
            fnArgs = handlerArgs === '' ? compiler.constants.requestObjectName : (
                handlerArgs.includes(',') ? '(' + handlerArgs + ')' : handlerArgs
            );

            key = root + key;
            if (vld)
                // Pass in v for validator and f for the actual fn
                group.post(key, Function('v', 'f', 'h',
                    `return ${fnArgs}=>`
                    + `v(${compiler.constants.requestObjectName}.data)===null?null`
                    + `:f(${handlerArgs})`
                )(vld, fn, badReq), routeOpts);
            else
                group.post(key, fn, routeOpts);
        }

        return {
            infer: o, group,
            // A plug to plugin the RPC router directly
            plugin: group.plugin.bind(group)
        };
    }

    /**
     * Create a router procedure without a validator. You need to modify `c.data` in 
     * the validator to match the type (if needed).
     */
    export function proc<D extends BodyParser>(format: D): Procedure<D, ParserType<D>>;

    /**
     * Create a router procedure. You need to modify `c.data` in 
     * the validator to match the type (if needed).
     */
    export function proc<D extends BodyParser, T>(format: D, v: Validator<ParserType<D>, T>): Procedure<D, T>;
    export function proc(format: any, v?: any) {
        return new Procedure(format, v);
    }

    export class Procedure<Format extends BodyParser = any, VldReturn = any, FnReturn = any> {
        // Support for custom response
        public fn: Handler;
        public wrapper: keyof typeof wrap | Wrapper = 'sendJSON';

        // Type infer
        public fnReturnType: FnReturn;
        public validatorReturn: VldReturn;

        constructor(
            public format: Format,
            public validator?: Validator<Format, VldReturn>
        ) { }

        /**
         * Wrap with a response wrapper
         */
        wrap(wrapper: keyof typeof wrap | Wrapper = 'default') {
            this.wrapper = wrapper;
            return this;
        }

        /**
         * Add a handler to the procedure
         */
        use<Q>(t: ProcHandler<VldReturn, Q>) {
            this.fn = t;
            // @ts-ignore
            return this as Procedure<Format, VldReturn, Q>;
        }
    }

    /**
     * Create a RPC client
     */
    export declare function client<T extends RouterProps<any>>(root: string): Infer<T['infer']>;
}

rpc.client = client;
