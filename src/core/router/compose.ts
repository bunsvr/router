import Radx from ".";
import { Handler, Wrapper } from "../types";
import {
    currentParamIndex, handlerPrefix, invalidBodyHandler, prevParamIndex, requestObjectPrefix,
    rejectPrefix, requestObjectName, storeObjectName, wsPrefix, urlStartIndex, requestParsedBody,
    requestMethod, requestURL, requestQueryIndex, requestParams, nfHandler, notFoundHeader, guardPrefix, wrapperPrefixes, badRequestHandler
} from "./constants";
import { Node } from "./types";

interface HandlerDetails extends Dict<any> {
    __index: number,
    __defaultReturn: string,
    __pathStr: string,
    __pathLen: string | null,
    __rejectIndex: number,
    __catchBody: string,
    __hasStore: boolean,
    __guardIndex: number,
    __wrapperIndex: number,
    __ws: any[]
}

type FunctionStore = Dict<Handler<any>>;

function extractArgs(fn: Function) {
    let str = fn.toString(),
        st = str.indexOf('('),
        ed = str.indexOf(')', st + 1);

    return str.substring(st, ed);
}

function resolveArgs(hasStore: boolean) {
    return hasStore ? requestObjectName + ',' + storeObjectName : requestObjectName;
}

function checkArgs(str: string | Function, hasStore: boolean) {
    if (typeof str !== 'string') str = extractArgs(str);

    if (str.length === 0) return '';
    // Multiple args
    if (str.includes(',')) return resolveArgs(hasStore);

    return requestObjectName;
}

export default function composeRouter(
    router: Radx, __hasStore: boolean, __ws: any[],
    startIndex: number | string, fn400: any, fn404: any
) {
    if (startIndex === 0) throw new Error('WTF');

    // Store all states
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn: 'return',
        __pathStr: requestURL, __wrapperIndex: 0,
        __pathLen: requestQueryIndex,
        __rejectIndex: 0, __catchBody: '',
        __hasStore, __ws, __guardIndex: 0
    };

    // Fn 400 modify the catch body
    if (fn400) {
        const args = extractArgs(fn400);

        // Assign the catch body
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = args.includes(',')
            ? `.catch(_=>${invalidBodyHandler}(_,${resolveArgs(__hasStore)}))`
            : `.catch(${invalidBodyHandler})`;
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
            handlersRec.__defaultReturn += ` ${nfHandler}(${checkArgs(fn404, __hasStore)})`;
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
        // Resolve guard
        if (node.store.GUARD) {
            res = guardCheck(handlers, node.store);
            // Add to queue the needed string 
            queue += res[1];
            // Add to str the function body
            str += res[0];
        }

        if (node.store.WRAP) {
            wrapper = node.store.WRAP;

            wrapper.callName = wrapperPrefixes + handlers.__wrapperIndex;
            handlers[wrapper.callName] = wrapper;
            ++handlers.__wrapperIndex;

            wrapper.isAsync ??= wrapper.constructor.name === 'AsyncFunction';
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

/**
 * Choose the best check for a method group
 */
export function methodSplit(store: FunctionStore, handlers: HandlerDetails, wrapper: Wrapper) {
    let method: string, hasP = false;
    const methods = [];

    // Ignore special methods and check whether POST, PUT or PATCH exists
    for (method in store)
        switch (method) {
            case 'ALL':
            case 'GUARD':
            case 'REJECT':
            case 'WRAP':
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

        return `if(${expr})${storeCheck(store[methods[0]], handlers, wrapper)}`;
    }

    // Multiple methods
    let str = `switch(${requestMethod}`;
    if (hasP) {
        str += '){';

        for (method of methods)
            str += `case'${method}':${storeCheck(store[method], handlers, wrapper)}`;
    } else {
        str += `.charCodeAt(0)){`;

        for (method of methods)
            str += `case ${method.charCodeAt(0)}:${storeCheck(store[method], handlers, wrapper)}`;
    }

    return str + '}';
}

/**
 * Checking methods and run the handler
 */
export function getStoreCall(store: FunctionStore, handlers: HandlerDetails, wrapper: Wrapper) {
    let str = methodSplit(store, handlers, wrapper);
    if ('ALL' in store) str += storeCheck(store['ALL'], handlers, wrapper);
    return str;
}

/**
 * Run the store
 */
export function storeCheck(fn: Handler, handlers: HandlerDetails, wrapper: Wrapper) {
    if (typeof fn === 'number') return getWSHandler(fn, handlers);
    // Ignore wrappers for macros
    if (fn.macro) return getMacroStr(fn);

    let str = 'return ',
        methodName = handlerPrefix + handlers.__index,
        methodCall = methodName + `(${checkArgs(fn, handlers.__hasStore)})`,
        additionalThen = '';

    // Add to handlers
    handlers[methodName] = fn;

    // Set wrapper
    if (wrapper) {
        if (wrapper.isAsync)
            additionalThen = `.then(${wrapper.callName})`;
        else
            methodCall = `${wrapper.callName}(${methodCall})`;
    }

    if (fn.body && fn.body !== 'none') {
        str += requestObjectPrefix;

        switch (fn.body) {
            case 'text': str += `text`; break;
            case 'json': str += `json`; break;
            case 'form': str += 'formData'; break;
            case 'blob': str += 'blob'; break;
            case 'buffer': str += 'arrayBuffer'; break;
            default: throw new Error('Invalid body parser specified: ' + fn.body);
        }

        str += `().then(_=>{${requestParsedBody}=_;`
            + `return ${methodCall}})`
            + additionalThen + handlers.__catchBody;
    } else str += methodCall + additionalThen;

    ++handlers.__index;
    return str + ';';
}

/**
 * Handle GUARD and REJECT
 */
function guardCheck(handlers: HandlerDetails, store: FunctionStore) {
    let returnStatement = handlers.__defaultReturn,
        str = '', queue = '', caller = '', args: string;

    // Check if a reject does exists to customize handling
    if (store.REJECT) {
        args = checkArgs(store.REJECT, handlers.__hasStore);
        caller = rejectPrefix + handlers.__rejectIndex;

        handlers[caller] = store.REJECT;
        returnStatement = `return ${caller}(${args})`;
        ++handlers.__rejectIndex;
    }

    // Add guard
    caller = guardPrefix + handlers.__guardIndex;
    handlers[caller] = store.GUARD;
    args = checkArgs(store.GUARD, handlers.__hasStore);

    if (store.GUARD.constructor.name === 'AsyncFunction') {
        str += `return ${caller}(${args}).then(_=>{if(_===null)${returnStatement};`;
        queue = '});';
    } else str += `if(${caller}(${args})===null)${returnStatement};`;

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
