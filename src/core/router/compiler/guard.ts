import { HandlerDetails, FunctionStore } from '../types';
import { Wrapper } from '../../types';
import { checkArgs } from './resolveArgs';
import { rejectPrefix, guardPrefix } from './constants';
import { checkWrap } from './wrapper';

/**
 * Handle GUARD and REJECT
 */
export function guardCheck(handlers: HandlerDetails, store: FunctionStore, wrapper: Wrapper) {
    let methodCall = handlers.__defaultReturn,
        str = '', queue = '', caller = '', args: string;

    // Check if a reject does exists to customize handling
    if (store.REJECT) {
        args = checkArgs(store.REJECT, 0);

        // Add to the scope 
        caller = rejectPrefix + handlers.__rejectIndex;
        ++handlers.__rejectIndex;
        handlers[caller] = store.REJECT;

        methodCall = `${caller}(${args})`;

        // Try assign a wrapper
        if (wrapper)
            methodCall = checkWrap(store.REJECT, wrapper, methodCall);

        methodCall = 'return ' + methodCall;
    }

    // Add guard
    caller = guardPrefix + handlers.__guardIndex;
    handlers[caller] = store.GUARD;
    ++handlers.__guardIndex;

    args = checkArgs(store.GUARD, 0);

    // Wrap the guard in async when needed
    if (store.GUARD.constructor.name === 'AsyncFunction') {
        str += `return ${caller}(${args}).then(_=>{if(_===null)${methodCall};`;
        queue = '});';
    } else str += `if(${caller}(${args})===null)${methodCall};`;

    return [str, queue];
}
