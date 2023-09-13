import Radx from ".";
import { Handler } from "../types";
import {
    currentParamIndex, handlerPrefix, invalidBodyHandler, prevParamIndex, requestObjectPrefix,
    rejectPrefix, requestObjectName, storeObjectName, wsPrefix, urlStartIndex, requestParsedBody,
    requestMethod, requestURL, requestQueryIndex, requestParams, nfHandler, notFoundHeader, guardPrefix
} from "./constants";
import { Node } from "./types";

interface HandlerDetails extends Dict<any> {
    __index: number,
    __defaultReturn: string,
    __pathStr: string,
    __pathLen: string | null,
    __rejectIndex: number,
    __catchBody: string,
    __callArgs: string,
    __guardIndex: number,
    __ws: any[]
}

function hasManyArgs(fn: Function) {
    let str = fn.toString(),
        st = str.indexOf('('),
        ed = str.indexOf(')', st + 1);
    str = str.substring(st, ed);
    return str.includes(',');
}

export default function composeRouter(
    router: Radx, __callArgs: string, __ws: any[],
    startIndex: number | string, fn400: any, fn404: any
) {
    if (startIndex === 0) throw new Error('WTF');

    // Store all states
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn: 'return',
        __pathStr: requestURL,
        __pathLen: requestQueryIndex,
        __rejectIndex: 0, __catchBody: '',
        __callArgs, __ws, __guardIndex: 0
    };

    // Fn 400 modify the catch body
    if (fn400) {
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = hasManyArgs(fn400)
            ? `.catch(_=>${invalidBodyHandler}(_,${__callArgs}))`
            : `.catch(${invalidBodyHandler})`;
    } else if (fn400 === false) {
        handlersRec[invalidBodyHandler] = () => new Response(null, notFoundHeader);
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
            handlersRec.__defaultReturn += ` ${nfHandler}(${__callArgs})`;
            handlersRec[nfHandler] = fn404;
        }

        composedBody = handlersRec.__defaultReturn;
    }

    // Composing nodes
    composedBody = composeNode(
        router.root, false, handlersRec,
        startIndex, false, false
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
        // Resolve guard
        if (node.store.GUARD) {
            res = guardCheck(handlers, node.store);
            // Add to queue the needed string 
            queue += res[1];
            // Add to str the function body
            str += res[0];
        }

        // Check if any other handler is provided other than GUARD and REJECT
        res = 0;
        for (iter in node.store)
            switch (iter as string) {
                case 'GUARD':
                case 'REJECT':
                    continue;

                default: ++res; break;
            }

        if (res != 0)
            str += `if(${handlers.__pathLen}===${currentPathLen}){${getStoreCall(node.store, handlers)}}`;
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
                hasParams, backupParamIndexExists
            )}}`;
        else {
            str += `switch(${handlers.__pathStr}.charCodeAt(${currentPathLen})){`

            // Skip checking if first done
            do {
                str += `case ${iter.value}:${composeNode(
                    node.inert.get(iter.value), true,
                    handlers, plus(currentPathLen, 1),
                    hasParams, backupParamIndexExists
                )}${handlers.__defaultReturn};`;

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
                };${getStoreCall(node.params.store, handlers)}}`;
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
                true, !res
            );
        }
    }

    if (node.wildcardStore !== null) {
        res = `${handlers.__pathStr}.substring(${currentPathLen})`;

        str += requestParams + (hasParams ? `['*']=${res}` : `={'*':${res}}`)
            + `;${getStoreCall(node.wildcardStore, handlers)}`;
    }

    if (node.part.length !== 0) queue += '}';
    return str + queue;
}

/**
 * Choose the best check for a method group
 */
export function methodSplit(fn: any, handlers: HandlerDetails) {
    let method: string, hasP = false;
    const methods = [];

    // Ignore special methods and check whether POST, PUT or PATCH exists
    for (method in fn)
        switch (method) {
            case 'ALL':
            case 'GUARD':
            case 'REJECT':
                continue;

            case 'POST':
            case 'PATCH':
            case 'PUT':
                hasP = true;

            default:
                methods.push(method);
                break;
        };

    if (methods.length === 0) return '';

    // Choose the best method handler to return
    if (methods.length === 1) {
        let expr: string = requestMethod + '.';
        switch (methods[0]) {
            case 'GET': expr += 'charCodeAt(0)===71'; break;
            case 'POST': expr += 'charCodeAt(2)===83'; break;
            case 'PUT': expr += 'charCodeAt(0)===80'; break;
            case 'DELETE': expr += 'length===6'; break;
            case 'PATCH': expr += 'charCodeAt(1)===65'; break;
            case 'CONNECT': expr += 'charCodeAt(2)===78'; break;
            case 'OPTIONS': expr += 'charCodeAt(0)===79'; break;
            case 'TRACE': expr += 'charCodeAt(0)===84'; break;
        }

        return `if(${expr})${storeCheck(fn[methods[0]], handlers)}`;
    }

    // Multiple methods
    let str = `switch(${requestMethod}`;
    if (hasP) {
        str += '){';

        for (method of methods)
            str += `case'${method}':${storeCheck(fn[method], handlers)}`;
    } else {
        str += `.charCodeAt(0)){`;

        for (method of methods)
            str += `case ${method.charCodeAt(0)}:${storeCheck(fn[method], handlers)}`;
    }

    return str + '}';
}

/**
 * Checking methods and run the handler
 */
export function getStoreCall(store: any, handlers: HandlerDetails) {
    let str = methodSplit(store, handlers);
    if ('ALL' in store) str += storeCheck(store['ALL'], handlers);
    return str;
}

/**
 * Run the store
 */
export function storeCheck(fn: Handler, handlers: HandlerDetails) {
    if (typeof fn === 'number') return getWSHandler(fn, handlers);
    if (fn.macro) return getMacroStr(fn);

    handlers[handlerPrefix + handlers.__index] = fn;

    let str = 'return ', methodCall = fn.macro
        ? getMacroStr(fn)
        : `${handlerPrefix}${handlers.__index}(${handlers.__callArgs});`;

    if (fn.body && fn.body !== 'none') {
        if (!fn.macro) methodCall = 'return ' + methodCall;
        str += requestObjectPrefix;

        switch (fn.body) {
            case 'text': str += `text`; break;
            case 'json': str += `json`; break;
            case 'form': str += 'formData'; break;
            case 'blob': str += 'blob'; break;
            case 'buffer': str += 'arrayBuffer'; break;
            default: throw new Error('Invalid body parser specified: ' + fn.body);
        }

        str += `().then(_=>{${requestParsedBody}=_;${methodCall}})${handlers.__catchBody};`
    } else str += methodCall;

    ++handlers.__index;
    return str;
}

/**
 * Handle GUARD and REJECT
 */
function guardCheck(handlers: HandlerDetails, store: any) {
    let returnStatement = handlers.__defaultReturn,
        str = '', queue = '', caller = '';

    // Check if a reject does exists to customize handling
    if (store.REJECT) {
        caller = rejectPrefix + handlers.__rejectIndex;

        handlers[caller] = store.REJECT;
        returnStatement = `return ${caller}(${handlers.__callArgs})`;
        ++handlers.__rejectIndex;
    }

    // Add guard
    caller = guardPrefix + handlers.__guardIndex;
    handlers[caller] = store.GUARD;

    if (store.GUARD.constructor.name === 'AsyncFunction') {
        str += `return ${caller}(${handlers.__callArgs}).then(_=>{if(_===null)${returnStatement};`;
        queue = '});';
    } else str += `if(${caller}(${handlers.__callArgs})===null)${returnStatement};`;

    ++handlers.__guardIndex;
    return [str, queue];
}

/**
 * Return the literal for WS upgrade
 */
function getWSHandler(fnIndex: number, handlers: HandlerDetails) {
    handlers[wsPrefix + fnIndex] = handlers.__ws[fnIndex];

    return `return this.upgrade(${requestObjectName},{data:{_:${wsPrefix}${fnIndex},ctx:${requestObjectName}${(
        handlers.__defaultReturn.includes(storeObjectName) ? `,store:${storeObjectName}` : ''
    )}}});`;
}

/**
 * Get the function body of a macro
 */
function getMacroStr(handler: Handler) {
    let macro = handler.toString();

    // Skip space to check for direct return 
    macro = macro.substring(macro.indexOf(')') + 1).trimStart();

    // If it is an arrow function
    if (macro.charCodeAt(0) !== 123) {
        // Remove arrow and trailing space 
        macro = macro.substring(2).trimStart();

        // If direct return
        if (macro.charCodeAt(0) !== 123) {
            if (macro.charCodeAt(macro.length - 1) !== 59) macro += ';';
            macro = 'return ' + macro;
        }
    }

    return macro;
}
