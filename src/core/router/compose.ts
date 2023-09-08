import Radx from ".";
import { BodyParser } from "../types";
import {
    currentParamIndex, handlerPrefix, invalidBodyHandler, prevParamIndex,
    rejectPrefix, requestObjectName, storeObjectName, wsPrefix, urlStartIndex
} from "./constants";
import { Node, ParamNode } from "./types";

interface HandlerDetails extends Dict<any> {
    __index: number,
    __defaultReturn: string,
    __pathStr: string,
    __pathLen: string | null,
    __rejectIndex: number,
    __catchBody: string,
}

function hasManyArgs(fn: Function) {
    let str = fn.toString(), st = str.indexOf('('), ed = str.indexOf(')');
    str = str.substring(st, ed);
    return str.includes(',');
}

export default function composeRouter(
    router: Radx, callArgs: string, __defaultReturn: string,
    startIndex: number | string, fn400: any
) {
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn,
        __pathStr: requestObjectName + '.url',
        __pathLen: requestObjectName + '.query',
        __rejectIndex: 0, __catchBody: ''
    }, methodsLiterals = [], fnHandlers = []; // Save handlers of methods

    if (fn400) {
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = hasManyArgs(fn400)
            ? `.catch(_=>${invalidBodyHandler}(_,${callArgs}))`
            : `.catch(${invalidBodyHandler})`;
    } else if (fn400 === false) {
        const t = { status: 400 };
        handlersRec[invalidBodyHandler] = () => new Response(null, t);
        handlersRec.__catchBody = `.catch(${invalidBodyHandler})`;
    }

    fixNode(router.root);
    const composedBody = composeNode(router.root, callArgs, handlersRec, startIndex);

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
    callArgs: string,
    handlers: HandlerDetails,
    fullPartPrevLen: number | string = 0,
    hasParams: boolean = false,
    backupParamIndexExists: boolean = false
) {
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
            const [h, q] = guardCheck(handlers, node.store, callArgs);
            queue += q;
            str += h;
        }

        // @ts-ignore Check if any other handler is provided other than GUARD and REJECT
        if (Object.keys(node.store).length - !!node.store.GUARD - !!node.store.REJECT >= 1)
            str += `if(${handlers.__pathLen}===${currentPathLen}){${getStoreCall(node.store, callArgs, handlers)}}`;
    }

    if (node.inert !== null) {
        const keys = Array.from(node.inert.keys());
        if (keys.length === 1)
            str += `if(${handlers.__pathStr}.charCodeAt(${currentPathLen})===${keys[0]}){${composeNode(
                node.inert.get(keys[0]), callArgs, handlers,
                plus(currentPathLen, 1),
                hasParams, backupParamIndexExists
            )
                }}`;
        else {
            str += `switch(${handlers.__pathStr}.charCodeAt(${currentPathLen})){`
            for (const key of keys)
                str += `case ${key}:${composeNode(
                    node.inert.get(key), callArgs, handlers,
                    plus(currentPathLen, 1),
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
                };${getStoreCall(node.params.store, callArgs, handlers)}}`;
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
                node.params.inert, callArgs, handlers,
                newPathLen, true, !pathLenIsNum
            );

            str += hasStore
                ? addParams + ';' + composeRes
                : `if(${currentParamIndex}===-1)${handlers.__defaultReturn};${addParams};${composeRes}`;
        }
    }

    if (node.wildcardStore !== null) {
        const pathSubstr = `${handlers.__pathStr}${currentPathLen === 0 && handlers.__parsePath ? '' : `.substring(${currentPathLen})`
            }`;

        str += requestObjectName + '.' + (hasParams
            ? `params['*']=${pathSubstr}`
            : `params={'*':${pathSubstr}}`);
        str += `;${getStoreCall(node.wildcardStore, callArgs, handlers)}`;

        hasParams = true;
    }

    if (node.part.length !== 0) queue += '}';
    return str + queue;
}

export function fixNode(currentNode: Node<any> | ParamNode<any>, isInert: boolean = false) {
    // Not a parametric node
    if ('part' in currentNode) {
        // @ts-ignore Check whether this node is an inert and not a parametric node and is fixed or not
        if (isInert && !currentNode.isFixed) {
            currentNode.part = currentNode.part.substring(1);
            // @ts-ignore
            currentNode.isFixed = true;
        }

        if (currentNode.inert !== null) for (const item of currentNode.inert)
            fixNode(item[1], true);

        if (currentNode.params !== null) fixNode(currentNode.params, false);
    } else if (currentNode.inert !== null) fixNode(currentNode.inert, false);
}

function isAsync(fn: any) {
    if (typeof fn === 'function') return fn.constructor.name === 'AsyncFunction';
    throw new Error('Guard should be a function, instead recieved: ' + fn);
}

export function getStoreCall(fn: any, callArgs: string, handlers: HandlerDetails) {
    let str = '', queue = '';

    for (const method in fn) {
        switch (method) {
            case 'ALL': case 'GUARD': case 'REJECT': continue;
            default: str += `if(${checkMethodExpr(method)})${storeCheck(fn[method], handlers, callArgs, handlers.__index)}`;
        }
    }

    if ('ALL' in fn) str += storeCheck(fn['ALL'], handlers, callArgs, handlers.__index);
    // If guard does exists
    else if (queue !== '') queue += handlers.__defaultReturn;

    return str + queue;
}

export function storeCheck(fn: any, handlers: HandlerDetails, callArgs: string, index: number) {
    if (typeof fn === 'number') return getWSHandler(fn, callArgs);
    if (fn.isMacro && !fn.body) return getMacroStr(fn);

    handlers[handlerPrefix + handlers.__index] = fn;
    ++handlers.__index;

    let str = 'return ', methodCall = fn.isMacro
        ? getMacroStr(fn)
        : `${handlerPrefix}${index}(${callArgs});`;

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
    return str;
}

function guardCheck(handlers: HandlerDetails, store: any, args: string) {
    let returnStatement = handlers.__defaultReturn, str = '', queue = '';
    // Check if a reject does exists to customize handling
    if (store.REJECT) {
        handlers[rejectPrefix + handlers.__rejectIndex] = store.REJECT;
        returnStatement = `return ${rejectPrefix}${handlers.__rejectIndex}(${args})`;
        ++handlers.__rejectIndex;
    }

    const guardFn = store.GUARD;
    handlers[handlerPrefix + handlers.__index] = guardFn;

    if (isAsync(guardFn)) {
        str += `return ${handlerPrefix}${handlers.__index}(${args}).then(_=>{if(_===null)${returnStatement};`;
        queue = '});';
    } else str += `if(${handlerPrefix}${handlers.__index}(${args})===null)${returnStatement};`;

    ++handlers.__index;
    return [str, queue];
}

function checkMethodExpr(method: string) {
    const m = requestObjectName + '.method'

    switch (method) {
        case 'GET': return m + '.charCodeAt(0)===' + 'G'.charCodeAt(0)
        case 'POST': return m + '.charCodeAt(2)===' + 'S'.charCodeAt(0)
        case 'PUT': return m + '.charCodeAt(0)===' + 'P'.charCodeAt(0)
        case 'DELETE': return m + '.length===6'
        case 'PATCH': return m + '.charCodeAt(1)===' + 'A'.charCodeAt(0)
        case 'CONNECT': return m + '.charCodeAt(2)===' + 'N'.charCodeAt(0)
        case 'OPTIONS': return m + '.charCodeAt(0)===' + 'O'.charCodeAt(0)
        case 'TRACE': return m + '.charCodeAt(0)===' + 'T'.charCodeAt(0)
    }
}

function getWSHandler(fnIndex: number, callArgs: string) {
    const hasStore = callArgs.length >= 3;
    return `return this.upgrade(${requestObjectName},{data:{_:${wsPrefix}${fnIndex},ctx:${requestObjectName}${hasStore
        ? `,store:${storeObjectName}` : ''
        }}});`;
}

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
