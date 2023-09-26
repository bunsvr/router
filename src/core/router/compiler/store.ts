import { FunctionStore, HandlerDetails } from '../types';
import { Wrapper, Handler, wrap } from '../../types';
import { requestMethod, handlerPrefix, requestObjectPrefix, requestParsedBody } from './constants';
import { initWrapper, checkWrap, wrapAsync } from './wrapper';
import { getWSHandler, getMacroHandler } from './getHandler';
import { checkArgs } from './resolveArgs';

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
    if (fn.macro) return getMacroHandler(fn);

    // Specific wrapper
    if (fn.wrap) {
        if (fn.wrap === true)
            fn.wrap = wrap.default;
        else if (typeof fn.wrap === 'string')
            fn.wrap = wrap[fn.wrap];

        initWrapper(handlers, fn.wrap);
        wrapper = fn.wrap;
    } else if (fn.wrap === false)
        wrapper = null;

    let str = 'return ',
        methodName = handlerPrefix + handlers.__index,
        methodCall = methodName + `(${checkArgs(fn, 0)})`;

    // Add to handlers
    handlers[methodName] = fn;
    ++handlers.__index;

    // Check body parser
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

        // This wrap when response is trully async
        str += `().then(function(_){${requestParsedBody}=_;`
            + `return ${methodCall}})`;

        if (wrapper) str += wrapAsync(wrapper);

        str += handlers.__catchBody;
    } else {
        // Wrap response normally
        if (wrapper)
            methodCall = checkWrap(fn, wrapper, methodCall);

        str += methodCall;
    }

    return str + ';';
}

