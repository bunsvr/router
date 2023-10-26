import { Handler } from '../../types';

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
