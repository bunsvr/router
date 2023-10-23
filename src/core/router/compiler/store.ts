import { FunctionStore, HandlerDetails } from '../types';
import { Wrapper, Handler, wrap } from '../../types';
import { handlerPrefix, requestObjectPrefix, requestParsedBody, cachedMethod } from './constants';
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
        return `if(${cachedMethod}==='${method}')${storeCheck(store[method], handlers, wrapper)}`;
    }

    // Multiple methods
    let str = `switch(${cachedMethod}){`;

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
            fn.wrap = wrap.plain;
        else if (typeof fn.wrap === 'string')
            fn.wrap = wrap[fn.wrap];

        initWrapper(handlers, fn.wrap);
        wrapper = fn.wrap;
    } else if (fn.wrap === false)
        wrapper = null;

    let methodName = handlerPrefix + handlers.__index,
        methodCall = `${methodName}(${checkArgs(fn, 0)})`,
        str = '';

    // Add to handlers
    handlers[methodName] = fn;
    ++handlers.__index;

    // Check body parser
    if (fn.body && fn.body !== 'none') {
        str += 'return ';

        switch (fn.body) {
            case 'text': str += requestObjectPrefix + 'text'; break;
            case 'json': str += requestObjectPrefix + 'json'; break;
            case 'form': str += requestObjectPrefix + 'formData'; break;
            case 'blob': str += requestObjectPrefix + 'blob'; break;
            case 'buffer': str += requestObjectPrefix + 'arrayBuffer'; break;
            default: throw new Error('Invalid body parser specified: ' + fn.body);
        }

        // This wrap when response is truly async
        str += `().then(_=>{${requestParsedBody}=_;return ${methodCall}})`;

        // Can't put guards here cuz it will break response wrappers
        if (wrapper) str += wrapAsync(wrapper);
        str += handlers.__catchBody;
    } else {
        // Wrap response normally
        if (wrapper)
            methodCall = checkWrap(fn, wrapper, methodCall);

        str += 'return ' + methodCall;
    }

    return str + ';';
}
