import { HandlerDetails } from '../types';
import { Wrapper } from '../../types';
import { checkArgs } from './resolveArgs';
import { rejectPrefix, guardPrefix } from './constants';
import { checkWrap } from './wrapper';

/**
 * Handle GUARD and REJECT
 */
export function guardCheck(handlers: HandlerDetails, guard: any, reject: any, wrapper: Wrapper): [str: string, queue: string] {
    let methodCall = handlers.__defaultReturn,
        str = '', queue = '', caller = '', args: string;

    // Check if a reject does exists to customize handling
    if (reject) {
        args = checkArgs(reject, 0);

        // Add to the scope 
        caller = rejectPrefix + handlers.__rejectIndex;
        ++handlers.__rejectIndex;
        handlers[caller] = reject;

        methodCall = `${caller}(${args})`;

        // Try assign a wrapper
        if (wrapper)
            methodCall = checkWrap(reject, wrapper, methodCall);

        methodCall = 'return ' + methodCall;
    }

    // Add guard
    caller = guardPrefix + handlers.__guardIndex;
    handlers[caller] = guard;
    ++handlers.__guardIndex;

    args = checkArgs(guard, 0);

    // Wrap the guard in async when needed
    if (guard.constructor.name === 'AsyncFunction') {
        str += `return ${caller}(${args}).then(_=>{if(_===null)${methodCall};`;
        queue = handlers.__defaultReturn + '});';
    } else str += `if(${caller}(${args})===null)${methodCall};`;

    return [str, queue];
}
