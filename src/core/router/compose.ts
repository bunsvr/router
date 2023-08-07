import Radx from ".";
import { BodyParser } from "../types";
import { Node, ParamNode } from "./types";

export default function composeRouter(router: Radx, callArgs: string, defaultReturn: string) {
    const handlersRec = { index: 0, defaultReturn }, methodsLiterals = [], fnHandlers = []; // Save handlers of methods
    fixNode(router.root);
    const composedBody = composeNode(router.root, callArgs, handlersRec);

    for (const itemName in handlersRec) {
        if (itemName === 'index' || itemName === 'defaultReturn') continue;
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
    if (num.length === 1) return num + '+' + val;

    let slices = num.split('+'), total = Number(slices[1]);

    return num[0] + '+' + (val + total);
}

function composeNode(
    node: Node<any>, 
    callArgs: string,
    handlers: Record<string, any> & { index: number, defaultReturn: string }, 
    fullPartPrevLen: number | string = 0,
    hasParams: boolean = false, 
    backupParamIndexExists: boolean = false
) {
    const currentPathLen = plus(fullPartPrevLen, node.part.length);
    let str = '', queue = '';

    if (node.part.length === 1) {
        str = `if(r.path.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}){`;
    } else if (node.part.length !== 0) { 
        str += 'if(' + (fullPartPrevLen === 0 
            ? (node.part.length === 1 
                ? `r.path.charCodeAt(0)===${node.part.charCodeAt(0)}` 
                : `r.path.startsWith('${node.part}')`
            ) 
            : (node.part.length === 1 
                ? `r.path.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}` 
                : `r.path.indexOf('${node.part}'${fullPartPrevLen === 0 ? '' : ',' + fullPartPrevLen})===${fullPartPrevLen}`
            )
        ) + '){';
    }

    // Check store, inert, wilcard and params
    if (node.store !== null) {
        // Resolve guard
        if (node.store.GUARD) {
            const guardFn = node.store.GUARD;

            handlers['c' + handlers.index] = guardFn;

            if (isAsync(guardFn)) {
                str += `return c${handlers.index}(${callArgs}).then(_=>{if(_===null)${handlers.defaultReturn};`;
                queue = '});';
            } else str += `if(c${handlers.index}(${callArgs})===null)${handlers.defaultReturn};`;

            ++handlers.index;
        }
        // If only GUARD exists don't handle
        if (Object.keys(node.store).length > 1 || !node.store.GUARD)
            str += `if(r.path.length===${currentPathLen}){${getStoreCall(node.store, callArgs, handlers)}}`;
    }

    if (node.inert !== null) {
        const keys = Array.from(node.inert.keys());
        if (keys.length === 1) 
            str += `if(r.path.charCodeAt(${currentPathLen})===${keys[0]}){${
                composeNode(
                    node.inert.get(keys[0]), callArgs, handlers, 
                    plus(currentPathLen, 1), 
                    hasParams, backupParamIndexExists
                )
            }}`;
        else {
            str += `switch(r.path.charCodeAt(${currentPathLen})){`
            for (const key of keys) 
                str += `case ${key}:{${composeNode(
                    node.inert.get(key), callArgs, handlers, 
                    plus(currentPathLen, 1), 
                    hasParams, backupParamIndexExists
                )};break}` 
            str += '}';
        }
    }

    if (node.params !== null) {
        str += `${backupParamIndexExists ? '' : 'let '}t=${currentPathLen};`;
        str += (hasParams ? '' : 'let ') + `e=r.path.indexOf('/',t);`;

        const hasStore = node.params.store !== null;

        // End index here
        if (hasStore) {
            const pathSubstr = `r.path${currentPathLen === 0 ? '' : `.substring(t)`}`;

            str += `if(e===-1){${hasParams 
                ? `r.params.${node.params.paramName}=${pathSubstr}`
                : `r.params={${node.params.paramName}:${pathSubstr}}`       
            };${getStoreCall(node.params.store, callArgs, handlers)}}`;
        } 
 
        const pathSubstr = `r.path.substring(t,e)`, addParams = hasParams 
            ? `r.params.${node.params.paramName}=${pathSubstr}`
            : `r.params={${node.params.paramName}:${pathSubstr}}`; 

        if (node.params.inert !== null) {
            const newPathLen = typeof currentPathLen === 'number' || backupParamIndexExists ? 'e+1' : plus(currentPathLen, 1);
            const composeRes = composeNode(node.params.inert, callArgs, handlers, newPathLen, true, true);

            str += hasStore 
                ? addParams + ';' + composeRes
                : `if(e===-1)${handlers.defaultReturn};${addParams};${composeRes}`;
        } 
    }

    if (node.wildcardStore !== null) {
        const pathSubstr = `r.path${currentPathLen === 0 ? '' : `.substring(${currentPathLen})`}`;

        str += hasParams 
            ? `r.params['*']=${pathSubstr}`
            : `r.params={'*':${pathSubstr}}`;
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

export function getStoreCall(fn: any, callArgs: string, handlers: { index: number, defaultReturn: string }) {
    let str = '', queue = '';

    for (const method in fn) {
        switch (method) {
            case 'ALL': case 'GUARD': continue;
            default: str += `if(${checkMethodExpr(method)})${storeCheck(fn[method], handlers, callArgs, handlers.index)}`;
        }
    }

    if ('ALL' in fn) str += storeCheck(fn['ALL'], handlers, callArgs, handlers.index);
    // If guard does exists
    else if (queue !== '') queue += handlers.defaultReturn;

    return str + queue;
}

// c: Prefix for normal handlers
// w: Prefix for WS
// h: Prefix for wrappers
export function storeCheck(fn: any, handlers: { index: number }, callArgs: string, index: number) {
    if (typeof fn === 'number') return getWSHandler(fn, callArgs);
    if (fn.isMacro) { 
        if (fn.body && fn.body !== 'none') throw new Error('Macros cannot be used with route options!');
        return getMacroStr(fn); 
    }

    handlers['c' + handlers.index] = fn;
    ++handlers.index;

    let str = 'return ', methodCall = `c${index}(${callArgs})`;
    
    if (fn.body && fn.body !== 'none') {
        methodCall = 'return ' + methodCall;
        str += 'r.';

        switch (fn.body as BodyParser) {
            case 'text': str += `text`; break;
            case 'json': str += `json`; break;
            case 'form': str += 'formData'; break;
            case 'blob': str += 'blob'; break;
            case 'buffer': str += 'arrayBuffer'; break;
            default: throw new Error('Invalid body parser specified: ' + fn.body);
        }

        str += `().then(_=>{r.data=_;${methodCall}});`
    } else str += methodCall + ';';
    return str;
}

function checkMethodExpr(method: string) {
    switch (method) {
        case 'GET': return 'r.method.charCodeAt(0)===' + 'G'.charCodeAt(0)
        case 'POST': return 'r.method.charCodeAt(2)===' + 'S'.charCodeAt(0)
        case 'PUT': return 'r.method.charCodeAt(0)===' + 'P'.charCodeAt(0)
        case 'DELETE': return 'r.method.length===6'
        case 'PATCH': return 'r.method.charCodeAt(1)===' + 'A'.charCodeAt(0)
        case 'CONNECT': return 'r.method.charCodeAt(2)===' + 'N'.charCodeAt(0)
        case 'OPTIONS': return 'r.method.charCodeAt(0)===' + 'O'.charCodeAt(0)
        case 'TRACE': return 'r.method.charCodeAt(0)===' + 'T'.charCodeAt(0)
    }
}

function getWSHandler(fnIndex: number, callArgs: string) {
    const hasStore = callArgs.length >= 3; 
    return `return this.upgrade(r, {data:{_:w${fnIndex},request:r${hasStore ? ',store:s' : ''}}});`;
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