import { checkArgs } from './resolveArgs';
import { HandlerDetails } from '../types';
import { Wrapper, Handler } from '../../types';
import { wrapperPrefix } from './constants';

export function initWrapper(handlers: HandlerDetails, wrapper: Wrapper) {
    // Add it to the scope
    wrapper.callName = wrapperPrefix + handlers.__wrapperIndex;
    handlers[wrapper.callName] = wrapper;
    ++handlers.__wrapperIndex;

    // Initialize additional params when the wrapper cannot be passed to `then()` directly
    if (!('params' in wrapper)) {
        wrapper.params = checkArgs(wrapper, 1);
        wrapper.hasParams = wrapper.params !== '';

        // Prepend with ',' for later concatenations
        if (wrapper.hasParams)
            wrapper.params = ',' + wrapper.params;
    }
}

export function checkWrap(fn: Handler, wrapper: Wrapper, methodCall: string) {
    return fn.chain || fn.constructor.name === 'AsyncFunction'
        ? methodCall + wrapAsync(wrapper)
        : wrapNormal(wrapper, methodCall);
}

export function wrapNormal(wrapper: Wrapper, methodCall: string) {
    return `${wrapper.callName}(${methodCall}${wrapper.params})`;
}

export function wrapAsync(wrapper: Wrapper) {
    return wrapper.hasParams
        ? `.then(_=>${wrapper.callName}(_${wrapper.params}))`
        : `.then(${wrapper.callName})`;
}
