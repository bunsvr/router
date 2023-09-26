import Radx from '..';
import { Wrapper } from '../../types';
import {
    currentParamIndex, invalidBodyHandler, prevParamIndex,
    urlStartIndex, requestURL, requestQueryIndex,
    requestParams, nfHandler, notFoundHeader, badRequestHandler
} from './constants';

import { Node, HandlerDetails } from '../types';

import { checkArgs } from "./resolveArgs";
import { initWrapper } from './wrapper';
import { guardCheck } from './guard';
import { getStoreCall } from './store';

export default function composeRouter(
    router: Radx, __ws: any[],
    startIndex: number | string, fn400: any, fn404: any
) {
    if (startIndex === 0) throw new Error('WTF');

    // Store all states
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn: 'return',
        __pathStr: requestURL, __wrapperIndex: 0,
        __pathLen: requestQueryIndex,
        __rejectIndex: 0, __catchBody: '',
        __ws, __guardIndex: 0
    };

    // Fn 400 modify the catch body
    if (fn400) {
        const args = checkArgs(fn400, 1);

        // Assign the catch body
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = args === ''
            ? `.catch(${invalidBodyHandler})`
            : `.catch(function(_){return ${invalidBodyHandler}(_,${args})})`;
    }
    // Special 400
    else if (fn400 === false) {
        handlersRec[invalidBodyHandler] = badRequestHandler;
        handlersRec.__catchBody = `.catch(${invalidBodyHandler})`;
    }

    let composedBody = '';

    // Fn 404 for default return
    if (fn404 || fn404 === false) {
        // Handle default and custom 404
        if (fn404 === false) {
            handlersRec.__defaultReturn += ` new Response(null,${nfHandler})`;
            handlersRec[nfHandler] = notFoundHeader;
        } else {
            handlersRec.__defaultReturn += ` ${nfHandler}(${checkArgs(fn404, 0)})`;
            handlersRec[nfHandler] = fn404;
        }

        composedBody = handlersRec.__defaultReturn;
    }

    // Composing nodes
    composedBody = composeNode(
        router.root, false, handlersRec,
        startIndex, false, false, null
    ) + composedBody;

    // Remove internals
    let key: string;
    for (key in handlersRec)
        if (key.startsWith('__'))
            delete handlersRec[key];

    return {
        store: handlersRec,
        fn: composedBody
    };
}

function plus(num: string | number, val: number) {
    if (val === 0) return num;
    if (typeof num === 'number') return num + val;

    let slices = num.split('+'),
        total = Number(slices[1]);

    if (isNaN(total)) total = 0;

    return slices[0] + '+' + (val + total);
}

function composeNode(
    node: Node<any>,
    isNormalInert: boolean,
    handlers: HandlerDetails,
    fullPartPrevLen: number | string,
    hasParams: boolean,
    backupParamIndexExists: boolean,
    wrapper: Wrapper
) {
    // Only fix inert
    if (isNormalInert && !('fixed' in node)) {
        node.part = node.part.substring(1);
        node.fixed = true;
    }

    const currentPathLen = plus(fullPartPrevLen, node.part.length);
    let str = '', queue = '',
        // For efficient storing
        iter: any, res: any;

    if (node.part.length === 1)
        str = `if(${handlers.__pathStr}.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}){`;
    else if (node.part.length !== 0) {
        str += 'if(' + (node.part.length === 1
            ? `${handlers.__pathStr}.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}`
            : `${handlers.__pathStr}.substring(${fullPartPrevLen},${currentPathLen})==='${node.part}'`
        ) + '){';
    }

    // Check store, inert, wilcard and params
    if (node.store !== null) {
        if (node.store.WRAP) {
            initWrapper(handlers, node.store.WRAP);
            wrapper = node.store.WRAP;
        }

        // Resolve guard
        if (node.store.GUARD) {
            res = guardCheck(handlers, node.store, wrapper);
            // Add to queue the needed string 
            queue += res[1];
            // Add to str the function body
            str += res[0];
        }

        // Check if any other handler is provided other than GUARD and REJECT
        countMethod:
        for (iter in node.store)
            switch (iter as string) {
                case 'GUARD':
                case 'REJECT':
                case 'WRAP':
                    continue countMethod;

                default:
                    str += `if(${handlers.__pathLen}===${currentPathLen}){${getStoreCall(
                        node.store, handlers, wrapper
                    )}}`;
                    break countMethod;
            }
    }

    if (node.inert !== null) {
        // The iterable instance
        res = node.inert.keys();
        // Iterator for keys
        iter = res.next();

        if (iter.done)
            str += `if(${handlers.__pathStr}.charCodeAt(${currentPathLen})===${iter.value}){${composeNode(
                node.inert.get(iter.value), true,
                handlers, plus(currentPathLen, 1),
                hasParams, backupParamIndexExists, wrapper
            )}}`;
        else {
            str += `switch(${handlers.__pathStr}.charCodeAt(${currentPathLen})){`

            // Skip checking if first done
            do {
                str += `case ${iter.value}:${composeNode(
                    node.inert.get(iter.value), true,
                    handlers, plus(currentPathLen, 1),
                    hasParams, backupParamIndexExists, wrapper
                )}break;`;

                // Go to next item
                iter = res.next();
            } while (!iter.done);

            str += '}';
        }
    }

    if (node.params !== null) {
        // Whether path length is a number
        res = typeof currentPathLen === 'number';

        const indexFrom = res ? currentPathLen : prevParamIndex,
            nextSlash = `${handlers.__pathStr}.indexOf('/',${indexFrom})`;

        if (!res)
            str += `${backupParamIndexExists ? '' : 'let '}${prevParamIndex}=${currentPathLen};`;

        if (node.params.inert !== null)
            str += `${hasParams ? '' : 'let '}${currentParamIndex}=${nextSlash};`;

        // End index here
        if (node.params.store !== null) {
            // Path substring
            iter = `${handlers.__pathStr}.substring(${indexFrom},${requestQueryIndex})`;

            str += `if(${node.params.inert !== null ? currentParamIndex : nextSlash}===-1){${requestParams}${hasParams
                ? `.${node.params.paramName}=${iter}`
                : `={${node.params.paramName}:${iter}}`
                };${getStoreCall(
                    node.params.store, handlers, wrapper
                )}}`;
        }

        if (node.params.inert !== null) {
            // Path substring
            iter = `${handlers.__pathStr}.substring(${indexFrom},${currentParamIndex})`;

            const addParams = requestParams + (hasParams
                ? `.${node.params.paramName}=${iter}`
                : `={${node.params.paramName}:${iter}}`
            );

            str += (node.params.store !== null
                ? addParams : `if(${currentParamIndex}===-1)${handlers.__defaultReturn};${addParams}`
            ) + ';' + composeNode(
                node.params.inert, false, handlers,
                // Check whether current path length includes the query index
                res || backupParamIndexExists
                    || (currentPathLen as string).startsWith(urlStartIndex)
                    ? plus(currentParamIndex, 1) : plus(currentPathLen, 1),
                true, !res, wrapper
            );
        }
    }

    if (node.wildcardStore !== null) {
        res = `${handlers.__pathStr}.substring(${currentPathLen})`;

        str += requestParams + (hasParams ? `['*']=${res}` : `={'*':${res}}`)
            + `;${getStoreCall(node.wildcardStore, handlers, wrapper)}`;
    }

    if (node.part.length !== 0) queue += '}';
    return str + queue;
}
