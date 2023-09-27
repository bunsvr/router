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
    let method: string;
    const methods = [];

    // Ignore special methods
    for (method in store)
        switch (method) {
            case 'ALL':
            case 'GUARD':
            case 'REJECT':
            case 'WRAP':
                continue;

            default:
                methods.push(method);
                break;
        };

    if (methods.length === 0) return '';
    if (methods.length === 1) {
        method = methods[0];
        return `if(${requestMethod}==='${method}')${storeCheck(store[method], handlers, wrapper)}`;
    }

    // Multiple methods
    let str = `switch(${requestMethod}){`;

    for (method of methods)
        str += `case'${method}':${storeCheck(store[method], handlers, wrapper)}`;

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
        str += `().then(_=>{${requestParsedBody}=_;`
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

