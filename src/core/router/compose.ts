import Radx from ".";
import { Node, ParamNode } from "./types";

export default function composeRouter(router: Radx, callArgs: string, returnStatement: string) {
    const methodsMap = {}, methodsLiterals = [], fnHandlers = []; // Save handlers of methods
    let index = 0;
    for (const methodName in router.root)
        if (router.root[methodName] !== null) {
            const currentRoot = router.root[methodName];
            fixNode(currentRoot);

            // Handlers and injections
            const handlersRec = { index: 0, defaultReturn: returnStatement, keyIndex: index }, 
                fnInnerBody = composeNode(currentRoot, callArgs, handlersRec);

            // Use as args
            for (const key in handlersRec) {
                if (key[0] === 'c') {
                    methodsLiterals.push(key);
                    fnHandlers.push(handlersRec[key]);
                }
            }
            
            methodsMap[methodName] = '{' + fnInnerBody + '}';  
            ++index;
        }

    const methodList = Object.keys(methodsMap);
    let fnLiteral = '';
    // Compose the switch
    if (methodList.length > 1) {
        fnLiteral = `switch(r.method.charCodeAt(0)){`;

        if ('GET' in methodsMap) 
            fnLiteral += `case ${'G'.charCodeAt(0)}:${methodsMap['GET']};`;

        if ('HEAD' in methodsMap) 
            fnLiteral += `case ${'H'.charCodeAt(0)}:${methodsMap['HEAD']};`;

        if ('OPTIONS' in methodsMap) 
            fnLiteral += `case ${'O'.charCodeAt(0)}:${methodsMap['OPTIONS']};`;

        if ('TRACE' in methodsMap) 
            fnLiteral += `case ${'T'.charCodeAt(0)}:${methodsMap['TRACE']};`;

        const hasPOST = 'POST' in methodsMap, hasPUT = 'PUT' in methodsMap, hasPATCH = 'PATCH' in methodsMap;
        // @ts-ignore
        const total: number = hasPOST + hasPUT + hasPATCH;
        if (total !== 0) {
            fnLiteral += 'default:';

            // Only one exists
            if (total === 1) {
                if (hasPOST) fnLiteral += `if(r.method.length===4)${methodsMap['POST']};`;
                else if (hasPATCH) fnLiteral += `if(r.method.length===5)${methodsMap['PATCH']};`;
                else fnLiteral += `if(r.method.length===3)${methodsMap['PUT']};`;
            } else { 
                fnLiteral += `switch(r.method.length){`;
                if (hasPOST) fnLiteral += `case 4:${methodsMap['POST']};`;
                if (hasPATCH) fnLiteral += `case 5:${methodsMap['PATCH']};`;
                if (hasPUT) fnLiteral += `case 3:${methodsMap['PUT']};`;

                fnLiteral += '}';
            };
        }

        fnLiteral += '}';
    } else if (methodList.length === 1) {
        switch (methodList[0]) {
            case 'GET': fnLiteral += `if(r.method.charCodeAt(0)===${'G'.charCodeAt(0)})${methodsMap['GET']};`;
            case 'POST': fnLiteral += `if(r.method.charCodeAt(2)===${'S'.charCodeAt(0)})${methodsMap['POST']};`;
            case 'PUT': fnLiteral += `if(r.method.charCodeAt(1)===${'U'.charCodeAt(0)})${methodsMap['PUT']};`;
            case 'DELETE': fnLiteral += `if(r.method.length===6)${methodsMap['DELETE']};`;
            case 'CONNECT': fnLiteral += `if(r.method.charCodeAt(0)===${'C'.charCodeAt(0)})${methodsMap['CONNECT']};`;
            case 'OPTIONS': fnLiteral += `if(r.method.charCodeAt(0)===${'O'.charCodeAt(0)})${methodsMap['OPTIONS']};`;
            case 'TRACE': fnLiteral += `if(r.method.charCodeAt(0)===${'T'.charCodeAt(0)})${methodsMap['TRACE']};`;
            case 'PATCH': fnLiteral += `if(r.method.charCodeAt(1)===${'A'.charCodeAt(0)})${methodsMap['PATCH']};`;
        }
    }

    return {
        literals: methodsLiterals,
        fn: fnLiteral,
        handlers: fnHandlers
    };
}

function plus(num: string | number, val: number) {
    if (typeof num === 'number') return num + val;
    if (num.length === 1) return num + '+' + val;

    let slices = num.split('+'), total = Number(slices[1]);

    return num[0] + '+' + (val + total);
}

function composeNode(
    node: Node<any>, 
    callArgs: string,
    handlers: Record<string, any> & { index: number, defaultReturn: string, keyIndex: number }, 
    fullPartPrevLen: number | string = 0,
    hasParams: boolean = false, 
    backupParamIndexExists: boolean = false
) {
    const currentPathLen = plus(fullPartPrevLen, node.part.length);
    let str = '';

    if (node.part.length === 1) {
        str = `if(r.path.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}){`;
    } else if (node.part.length !== 0) { 
        str += 'if(' + (fullPartPrevLen === 0 
            ? (node.part.length === 1 
                ? `r.path.charCodeAt(0)===${node.part.charCodeAt(0)}` 
                : `r.path.startsWith(${node.part})`
            ) 
            : (node.part.length === 1 
                ? `r.path.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}` 
                : `r.path.indexOf('${node.part}'${fullPartPrevLen === 0 ? '' : ',' + fullPartPrevLen})===${fullPartPrevLen}`
            )
        ) + '){';
    }

    // Check store, inert, wilcard and params
    if (node.store !== null) 
        str += `if(r.path.length===${currentPathLen})${getStoreCall(node.store, handlers.index, callArgs, handlers)}`;

    if (node.inert !== null) {
        const keys = Array.from(node.inert.keys());
        if (keys.length === 1) 
            str += `if(r.path.charCodeAt(${currentPathLen})===${keys[0]}){${
                composeNode(node.inert.get(keys[0]), callArgs, handlers, plus(currentPathLen, 1), hasParams, backupParamIndexExists)
            }}`;
        else {
            str += `switch(r.path.charCodeAt(${currentPathLen})){`
            for (const key of keys) 
                str += `case ${key}:{${composeNode(node.inert.get(key), callArgs, handlers, plus(currentPathLen, 1), hasParams, backupParamIndexExists)};break}` 
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
            };${getStoreCall(node.params.store, handlers.index, callArgs, handlers)}}`;
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
        str += `;${getStoreCall(node.wildcardStore, handlers.index, callArgs, handlers)}`;

        hasParams = true;
    }

    if (node.part.length !== 0) str += '}';

    return str;
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

export function getStoreCall(fn: any, index: number, callArgs: string, handlers: { index: number, keyIndex: number }) {
    if (typeof fn === 'number') return getWSHandler(fn, callArgs);
    if (fn.isMacro) return getMacroStr(fn); // Macro

    handlers['c' + handlers.keyIndex + '_' + handlers.index] = fn;
    ++handlers.index;
    return `return c${handlers.keyIndex}_${index}(${callArgs});`;
}

function getWSHandler(fnIndex: number, callArgs: string) {
    const hasStore = callArgs.length >= 3; 
    return `return this.upgrade(r, {data:{_:w${fnIndex},request:r${hasStore ? ',store:s' : ''}}});`;
}

function getMacroStr(handler: any) {
    let macro = handler.toString();

    // Skip space to check for direct return 
    macro = macro.substring(macro.indexOf(')') + 2);

    // If it is an arrow function
    if (macro[0] !== '{') {
        // Remove arrow and trailing space 
        macro = macro.substring(3);

        // If direct return
        if (macro[0] !== '{') {
            if (macro.at(-1) !== ';') macro += ';';
            macro = 'return ' + macro;
        }
    }

    return macro;
}
