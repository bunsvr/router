import { HandlerDetails } from '../types';
import { Handler } from '../../types';
import { requestObjectName, wsPrefix } from './constants';

/**
 * Return the literal for WS upgrade
 */
export function getWSHandler(fnIndex: number, handlers: HandlerDetails) {
    const name = wsPrefix + fnIndex;
    handlers[name] = handlers.__ws[fnIndex];
    return `return this.upgrade(${requestObjectName},{data:{_:${name},ctx:${requestObjectName},server:this}});`;
}

/**
 * Get the function body of a macro
 */
export function getMacroHandler(handler: Handler) {
    let macro = handler.toString();

    // Skip space to check for direct return 
    macro = macro.substring(macro.indexOf(')') + 1).trimStart();

    // If it is an arrow function
    if (macro.charCodeAt(0) !== 123) {
        // Remove arrow and trailing space 
        macro = macro.substring(2).trimStart();

        // If direct return
        if (macro.charCodeAt(0) !== 123) {
            if (macro.charCodeAt(macro.length - 1) !== 59) macro += ';';
            macro = 'return ' + macro;
        }
    }

    return macro;
}
