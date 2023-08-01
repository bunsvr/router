import { type } from "os";
import Radx from ".";
import { Node, ParamNode } from "./types";

export default function composeRouter(router: Radx, callArgs: string) {
    const methods = {};
    for (const methodName in router.root)
        if (router.root[methodName] !== null) {
            const currentRoot = router.root[methodName];
            fixNode(currentRoot);

            const handlersRec = { index: 0, defaultReturn: 'return' }, fnInnerBody = composeNode(currentRoot, callArgs, handlersRec);
        }
}

function plus(num: string | number, val: number) {
    if (typeof num === 'number') return num + val;
    if (num.length === 1) return num + '+' + val;

    let slices = num.split('+'), total = Number(slices[1]);

    return num[0] + '+' + val + total;
}

function composeNode(
    node: Node<any>, 
    callArgs: string,
    handlers: Record<string, any> & { index: number, defaultReturn: string }, 
    fullPartPrevLen: number | string = 0,
    hasParams: boolean = false
) {
    let currentPathLen = plus(fullPartPrevLen, node.part.length), str = '';

    if (node.part.length === 1) str = `if(r.path.charCodeAt(${fullPartPrevLen})===${node.part.charCodeAt(0)}){`;
    else if (node.part.length !== 0) 
        str += 'if(' + (fullPartPrevLen === 0 
            ? `r.path.startsWith(${node.part})` 
            : `r.path.indexOf('${node.part}'${fullPartPrevLen === 0 ? '' : ',' + fullPartPrevLen})===${fullPartPrevLen}`
        ) + '){';

    // Check store, inert, wilcard and params
    if (node.store !== null) {
        handlers['c' + handlers.index] = node.store;
        str += `if(r.path.length===${currentPathLen})return c${handlers.index}(${callArgs});`;
        ++handlers.index;
    }

    let defaultNotClosed = false;
    if (node.inert !== null) {
        const keys = Array.from(node.inert.keys());
        if (keys.length === 1) 
            str += `if(r.path.charCodeAt(${currentPathLen})===${keys[0]}){${
                composeNode(node.inert.get(keys[0]), callArgs, handlers, plus(currentPathLen, 1), hasParams)
            }}`;
        else {
            str += `switch(r.path.charCodeAt(${currentPathLen})){`
            for (const key of keys) 
                str += `case ${key}:{${composeNode(node.inert.get(key), callArgs, handlers, plus(currentPathLen, 1), hasParams)}}` 
            str += 'default:{';

            defaultNotClosed = true;
        }
    }

    if (node.params !== null) {
        str += (hasParams ? '' : 'let ') + `e=r.path.indexOf('/'${currentPathLen === 0 ? '' : (',' + currentPathLen)});`;
        const hasStore = node.params.store !== null;

        // End index here
        if (hasStore) {
            handlers['c' + handlers.index] = node.params.store;
            const pathSubstr = `r.path${currentPathLen === 0 ? '' : `.substring(${currentPathLen})`}`;

            str += `if(e===-1){${hasParams 
                ? `r.params.${node.params.paramName}=${pathSubstr}`
                : `r.params={${node.params.paramName}:${pathSubstr}}`       
            };return c${handlers.index}(${callArgs});}`;

            ++handlers.index;
            hasParams = true;
        }

        if (node.params.inert !== null) {
            currentPathLen = typeof currentPathLen === 'number' ? 'e+1' : plus(currentPathLen, 1);
            const composeRes = composeNode(node.params.inert, callArgs, handlers, currentPathLen, hasParams);

            str += hasStore 
                ? `else{${composeRes}}`
                : `if(e===-1)${handlers.defaultReturn};${composeRes}`;
        }
    }

    if (node.wildcardStore !== null) {
        handlers['c' + handlers.index] = node.store;
        const pathSubstr = `r.path${currentPathLen === 0 ? '' : `.substring(${currentPathLen})`}`;

        str += hasParams 
            ? `r.params['*']=${pathSubstr}`
            : `r.params={'*':${pathSubstr}}`;
        str += `;return c${handlers.index}(${callArgs});`;

        ++handlers.index;
        hasParams = true;
    }

    if (defaultNotClosed) str += '}}';
    if (node.part.length !== 0) str += '}';

    return str;
}

export function fixNode(currentNode: Node<any> | ParamNode<any>, isInert: boolean = false) {
    // Not a parametric node
    if ('part' in currentNode) {
        // Check whether this node is an inert and not a parametric node
        if (isInert) currentNode.part = currentNode.part.substring(1);

        if (currentNode.inert !== null) for (const item of currentNode.inert) 
            fixNode(item[1], true);

        if (currentNode.params !== null) fixNode(currentNode.params, false);
    } else if (currentNode.inert !== null) fixNode(currentNode.inert, false);
}


// Testing
const simpleRouter = new Radx();
simpleRouter.add('GET', '/', 0);
simpleRouter.add('GET', '/json/id', 1);
simpleRouter.add('GET', '/json/yeet', 2);
simpleRouter.add('GET', '/json/*', 3);
simpleRouter.add('GET', '/:id', 4);
simpleRouter.add('GET', '/user/:id/dashboard', 5);
fixNode(simpleRouter.root['GET']);
console.log(composeNode(simpleRouter.root['GET'], 'r', { index: 0, defaultReturn: 'return' }));

console.log('----------------------');

const router = new Radx();
router.add('GET', '/', () => 'Hi');
router.add('GET', '/k', () => 'Hi as well')
router.add('POST', '/json', () => '{hi:"there"}');
router.add('POST', '/jk', () => 'Collision');
router.add('POST', '/json/but/longer', () => 'nothing lol');
router.add('GET', '/id/:id', () => 'Hi there user!');

//console.log(router.root);
