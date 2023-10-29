import { initWrapper } from './wrapper';
import { guardCheck } from './guard';
import { getStoreCall } from './store';
import { Wrapper } from '../../types';
import {
    currentParamIndex, prevParamIndex, urlStartIndex,
    requestParams, requestQueryIndex
} from './constants';
import { Node, HandlerDetails } from '../types';

function plus(num: string | number, val: number) {
    if (val === 0) return num;
    if (typeof num === 'number') return num + val;

    let slices = num.split('+'),
        total = Number(slices[1]);

    if (isNaN(total)) total = 0;

    return slices[0] + '+' + (val + total);
}

export function checkPath(
    handlers: HandlerDetails,
    part: string, fullPartPrevLen: string | number,
    currentPathLen: string | number
) {
    if (part.length < 15) {
        let result = '';

        for (var i = 0; i < part.length; ++i) {
            result += `if(${handlers.__pathStr}.charCodeAt(${fullPartPrevLen})===${part.charCodeAt(i)})`;
            fullPartPrevLen = plus(fullPartPrevLen, 1);
        }

        return result;
    }

    return `if(${handlers.__pathStr}.substring(${fullPartPrevLen},${currentPathLen})==='${part}')`;
}

export function compileNode(
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
    let str = node.part.length === 0
        ? '' : checkPath(
            handlers, node.part,
            fullPartPrevLen, currentPathLen
        ) + '{', queue = '',
        // For efficient storing
        iter: any, res: any;

    // Check store, inert, wilcard and params
    if (node.store !== null) {
        if (node.store.WRAP) {
            initWrapper(handlers, node.store.WRAP);
            wrapper = node.store.WRAP;
        }

        // Resolve guard
        if (node.store.GUARD) {
            res = guardCheck(handlers, node.store.GUARD, node.store.REJECT, wrapper);
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
            str += `if(${handlers.__pathStr}.charCodeAt(${currentPathLen})===${iter.value}){${compileNode(
                node.inert.get(iter.value), true,
                handlers, plus(currentPathLen, 1),
                hasParams, backupParamIndexExists, wrapper
            )}}`;
        else {
            str += `switch(${handlers.__pathStr}.charCodeAt(${currentPathLen})){`

            // Skip checking if first done
            do {
                str += `case ${iter.value}:${compileNode(
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
            str += `${backupParamIndexExists ? '' : 'var '}${prevParamIndex}=${currentPathLen};`;

        if (node.params.inert !== null)
            str += `${hasParams ? '' : 'var '}${currentParamIndex}=${nextSlash};`;

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
            ) + ';' + compileNode(
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

