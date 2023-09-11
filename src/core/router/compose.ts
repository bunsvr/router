import Radx from ".";
import { BodyParser } from "../types";
import {
    currentParamIndex, handlerPrefix, invalidBodyHandler, prevParamIndex,
    rejectPrefix, requestObjectName, storeObjectName, wsPrefix, urlStartIndex, requestMethod
} from "./constants";
import { Node } from "./types";

interface HandlerDetails extends Dict<any> {
    __index: number,
    __defaultReturn: string,
    __pathStr: string,
    __pathLen: string | null,
    __rejectIndex: number,
    __catchBody: string,
    __callArgs: string
}

function hasManyArgs(fn: Function) {
    let str = fn.toString(),
        st = str.indexOf('('),
        ed = str.indexOf(')');
    str = str.substring(st, ed);
    return str.includes(',');
}

export default function composeRouter(
    router: Radx, __callArgs: string, __defaultReturn: string,
    startIndex: number | string, fn400: any
) {
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn,
        __pathStr: requestObjectName + '.url',
        __pathLen: requestObjectName + '.query',
        __rejectIndex: 0, __catchBody: '',
        __callArgs
    }, methodsLiterals = [], fnHandlers = []; // Save handlers of methods

    // Fn 400 modify the catch body
    if (fn400) {
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = hasManyArgs(fn400)
            ? `.catch(_=>${invalidBodyHandler}(_,${__callArgs}))`
            : `.catch(${invalidBodyHandler})`;
    } else if (fn400 === false) {
        const t = { status: 400 };
        handlersRec[invalidBodyHandler] = () => new Response(null, t);
        handlersRec.__catchBody = `.catch(${invalidBodyHandler})`;
    }

    if (startIndex === 0) throw new Error('WTF');
    const composedBody = composeNode(
        router.root, false, handlersRec,
        startIndex, false, false
    );

    let itemName: string;
    for (itemName in handlersRec) {
        if (itemName.startsWith('__')) continue;
        methodsLiterals.push(itemName);
        fnHandlers.push(handlersRec[itemName]);
    }

    return {
        literals: methodsLiterals,
        fn: composedBody,
        handlers: fnHandlers
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

            // Optimization: Skip checking if first done
            do {
                str += `case ${iter.value}:${composeNode(
                    node.inert.get(iter.value), true,
                    handlers, plus(currentPathLen, 1),
                    hasParams, backupParamIndexExists
                )}${handlers.__defaultReturn};`;

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
            iter = `${handlers.__pathStr}.substring(${indexFrom}${handlers.__parsePath ? '' : `,${requestObjectName}.query)`}`;

            str += `if(${node.params.inert !== null ? currentParamIndex : nextSlash}===-1){${requestObjectName}.params${hasParams
                ? `.${node.params.paramName}=${iter}`
                : `={${node.params.paramName}:${iter}}`
                };${getStoreCall(node.params.store, handlers)}}`;
        }

        if (node.params.inert !== null) {
            // Path substring
            iter = `${handlers.__pathStr}.substring(${indexFrom},${currentParamIndex})`;

            const addParams = requestObjectName + '.params' + (hasParams
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
        const pathSubstr = `${handlers.__pathStr}.substring(${currentPathLen})`;

        str += requestObjectName + '.' + (hasParams
            ? `params['*']=${pathSubstr}`
            : `params={'*':${pathSubstr}}`);
        str += `;${getStoreCall(node.wildcardStore, handlers)}`;

        hasParams = true;
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
export function getStoreCall(fn: any, handlers: HandlerDetails) {
    let str = methodSplit(fn, handlers);
    if ('ALL' in fn) str += storeCheck(fn['ALL'], handlers);
    return str;
}

/**
 * Run the store
 */
export function storeCheck(fn: any, handlers: HandlerDetails) {
    if (typeof fn === 'number') return getWSHandler(fn, handlers.__callArgs);
    if (fn.isMacro && !fn.body) return getMacroStr(fn);

    handlers[handlerPrefix + handlers.__index] = fn;

    let str = 'return ', methodCall = fn.isMacro
        ? getMacroStr(fn)
        : `${handlerPrefix}${handlers.__index}(${handlers.__callArgs});`;

    if (fn.body && fn.body !== 'none') {
        if (!fn.isMacro) methodCall = 'return ' + methodCall;
        str += requestObjectName + '.';

        switch (fn.body as BodyParser) {
            case 'text': str += `text`; break;
            case 'json': str += `json`; break;
            case 'form': str += 'formData'; break;
            case 'blob': str += 'blob'; break;
            case 'buffer': str += 'arrayBuffer'; break;
            default: throw new Error('Invalid body parser specified: ' + fn.body);
        }

        str += `().then(_=>{${requestObjectName}.data=_;${methodCall}})${handlers.__catchBody};`
    } else str += methodCall;

    ++handlers.__index;
    return str;
}

/**
 * Handle GUARD and REJECT
 */
function guardCheck(handlers: HandlerDetails, store: any) {
    let returnStatement = handlers.__defaultReturn, str = '', queue = '';
    // Check if a reject does exists to customize handling
    if (store.REJECT) {
        handlers[rejectPrefix + handlers.__rejectIndex] = store.REJECT;
        returnStatement = `return ${rejectPrefix}${handlers.__rejectIndex}(${handlers.__callArgs})`;
        ++handlers.__rejectIndex;
    }
    handlers[handlerPrefix + handlers.__index] = store.GUARD;

    if (store.GUARD.constructor.name === 'AsyncFunction') {
        str += `return ${handlerPrefix}${handlers.__index}(${handlers.__callArgs}).then(_=>{if(_===null)${returnStatement};`;
        queue = '});';
    } else str += `if(${handlerPrefix}${handlers.__index}(${handlers.__callArgs})===null)${returnStatement};`;

    ++handlers.__index;
    return [str, queue];
}

/**
 * Return the literal for WS upgrade
 */
function getWSHandler(fnIndex: number, callArgs: string) {
    return `return this.upgrade(${requestObjectName},{data:{_:${wsPrefix}${fnIndex},ctx:${requestObjectName
        }${callArgs.includes(storeObjectName) ? `,store:${storeObjectName}` : ''}}});`;
}

/**
 * Get the function body of a macro
 */
function getMacroStr(handler: any) {
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
