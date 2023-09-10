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

    const composedBody = composeNode(router.root, false, handlersRec, startIndex);

    for (const itemName in handlersRec) {
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
    fullPartPrevLen: number | string = 0,
    hasParams: boolean = false,
    backupParamIndexExists: boolean = false,
) {
    // Only fix inert
    if (isNormalInert && !('fixed' in node)) {
        node.part = node.part.substring(1);
        node.fixed = true;
    }

    const currentPathLen = plus(fullPartPrevLen, node.part.length);
    let str = '', queue = '';

    if (node.part.length === 1) {
        str = `if(${handlers.__pathStr}.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}){`;
    } else if (node.part.length !== 0) {
        str += 'if(' + (fullPartPrevLen === 0
            ? (node.part.length === 1
                ? `${handlers.__pathStr}.charCodeAt(0)===${node.part.charCodeAt(0)}`
                : `${handlers.__pathStr}.path.startsWith('${node.part}')`
            )
            : (node.part.length === 1
                ? `${handlers.__pathStr}.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}`
                : `${handlers.__pathStr}.substring(${fullPartPrevLen},${currentPathLen})==='${node.part}'`
            )
        ) + '){';
    }

    // Check store, inert, wilcard and params
    if (node.store !== null) {
        // Resolve guard
        if (node.store.GUARD) {
            const res = guardCheck(handlers, node.store);
            // Add to queue the needed string 
            queue += res[1];
            // Add to str the function body
            str += res[0];
        }

        // @ts-ignore Check if any other handler is provided other than GUARD and REJECT
        if (Object.keys(node.store).length - !!node.store.GUARD - !!node.store.REJECT > 0)
            str += `if(${handlers.__pathLen}===${currentPathLen}){${getStoreCall(node.store, handlers)}}`;
    }

    if (node.inert !== null) {
        const keys = Array.from(node.inert.keys());
        if (keys.length === 1)
            str += `if(${handlers.__pathStr}.charCodeAt(${currentPathLen})===${keys[0]}){${composeNode(
                node.inert.get(keys[0]), true,
                handlers, plus(currentPathLen, 1),
                hasParams, backupParamIndexExists
            )}}`;
        else {
            str += `switch(${handlers.__pathStr}.charCodeAt(${currentPathLen})){`
            for (const key of keys)
                str += `case ${key}:${composeNode(
                    node.inert.get(key), true,
                    handlers, plus(currentPathLen, 1),
                    hasParams, backupParamIndexExists
                )}${handlers.__defaultReturn};`
            str += '}';
        }
    }

    if (node.params !== null) {
        const tDec = `${prevParamIndex}=${currentPathLen}`,
            pathLenIsNum = typeof currentPathLen === 'number',
            indexFrom = pathLenIsNum ? currentPathLen : prevParamIndex,
            nextSlash = `${handlers.__pathStr}.indexOf('/',${indexFrom})`,
            eDec = `${currentParamIndex}=${nextSlash}`,
            // If has no inert then no need to create a variable
            hasInert = node.params.inert !== null;

        if (!pathLenIsNum) str += `${backupParamIndexExists ? '' : 'let '}${tDec};`;
        if (hasInert) str += (hasParams ? '' : 'let ') + eDec + `;`;

        const hasStore = node.params.store !== null;

        // End index here
        if (hasStore) {
            const pathSubstr = `${handlers.__pathStr}${currentPathLen === 0 ? (
                handlers.__parsePath ? '' : `.substring(0,${requestObjectName}.query)`
            ) : `.substring(${indexFrom}${handlers.__parsePath ? '' : `,${requestObjectName}.query`})`}`;

            str += `if(${hasInert ? currentParamIndex : nextSlash}===-1){${requestObjectName}.params${hasParams
                ? `.${node.params.paramName}=${pathSubstr}`
                : `={${node.params.paramName}:${pathSubstr}}`
                };${getStoreCall(node.params.store, handlers)}}`;
        }

        const pathSubstr = `${handlers.__pathStr}.substring(${indexFrom},${currentParamIndex})`,
            addParams = requestObjectName + '.params' + (hasParams
                ? `.${node.params.paramName}=${pathSubstr}`
                : `={${node.params.paramName}:${pathSubstr}}`
            );

        if (hasInert) {
            const newPathLen = typeof currentPathLen === 'number'
                || backupParamIndexExists
                // For no base specified
                || currentPathLen.startsWith(urlStartIndex) ? plus(currentParamIndex, 1) : plus(currentPathLen, 1);

            const composeRes = composeNode(
                node.params.inert, false, handlers,
                newPathLen, true, !pathLenIsNum
            );

            str += hasStore
                ? addParams + ';' + composeRes
                : `if(${currentParamIndex}===-1)${handlers.__defaultReturn};${addParams};${composeRes}`;
        }
    }

    if (node.wildcardStore !== null) {
        const pathSubstr = `${handlers.__pathStr}${currentPathLen === 0 && handlers.__parsePath
            ? '' : `.substring(${currentPathLen})`}`;

        str += requestObjectName + '.' + (hasParams
            ? `params['*']=${pathSubstr}`
            : `params={'*':${pathSubstr}}`);
        str += `;${getStoreCall(node.wildcardStore, handlers)}`;

        hasParams = true;
    }

    if (node.part.length !== 0) queue += '}';
    return str + queue;
}

function isAsync(fn: any) {
    if (typeof fn === 'function') return fn.constructor.name === 'AsyncFunction';
    throw new Error('Guard should be a function, instead recieved: ' + fn);
}

/**
 * Choose the best check for a method group
 */
export function methodSplit(fn: any, handlers: HandlerDetails) {
    let method: string, hasP = false;
    const methods = [];

    for (method in fn) {
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
        }
    }

    if (methods.length === 1)
        return `if(${checkMethodExpr(methods[0])})${storeCheck(fn[methods[0]], handlers)}`;

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

    const guardFn = store.GUARD;
    handlers[handlerPrefix + handlers.__index] = guardFn;

    if (isAsync(guardFn)) {
        str += `return ${handlerPrefix}${handlers.__index}(${handlers.__callArgs}).then(_=>{if(_===null)${returnStatement};`;
        queue = '});';
    } else str += `if(${handlerPrefix}${handlers.__index}(${handlers.__callArgs})===null)${returnStatement};`;

    ++handlers.__index;
    return [str, queue];
}

/**
 * Return the best check for one method
 */
function checkMethodExpr(method: string) {
    switch (method) {
        case 'GET': return requestMethod + '.charCodeAt(0)===' + 'G'.charCodeAt(0)
        case 'POST': return requestMethod + '.charCodeAt(2)===' + 'S'.charCodeAt(0)
        case 'PUT': return requestMethod + '.charCodeAt(0)===' + 'P'.charCodeAt(0)
        case 'DELETE': return requestMethod + '.length===6'
        case 'PATCH': return requestMethod + '.charCodeAt(1)===' + 'A'.charCodeAt(0)
        case 'CONNECT': return requestMethod + '.charCodeAt(2)===' + 'N'.charCodeAt(0)
        case 'OPTIONS': return requestMethod + '.charCodeAt(0)===' + 'O'.charCodeAt(0)
        case 'TRACE': return requestMethod + '.charCodeAt(0)===' + 'T'.charCodeAt(0)
    }
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
    if (macro[0] !== '{') {
        // Remove arrow and trailing space 
        macro = macro.substring(2).trimStart();

        // If direct return
        if (macro[0] !== '{') {
            if (macro.at(-1) !== ';') macro += ';';
            macro = 'return ' + macro;
        }
    }

    return macro;
}
