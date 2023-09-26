import Radx from '..';
import {
    invalidBodyHandler, requestURL, requestQueryIndex,
    nfHandler, notFoundHeader, badRequestHandler
} from './constants';

import { HandlerDetails } from '../types';

import { checkArgs } from "./resolveArgs";
import { compileNode } from './node';

export default function compileRouter(
    router: Radx, __ws: any[],
    startIndex: number | string, fn400: any, fn404: any
) {
    if (startIndex === 0) throw new Error('WTF');

    // Store all states
    const handlersRec: HandlerDetails = {
        __index: 0, __defaultReturn: 'return',
        __pathStr: requestURL, __wrapperIndex: 0,
        __pathLen: requestQueryIndex,
        __rejectIndex: 0, __catchBody: '',
        __ws, __guardIndex: 0
    };

    // Fn 400 modify the catch body
    if (fn400) {
        const args = checkArgs(fn400, 1);

        // Assign the catch body
        handlersRec[invalidBodyHandler] = fn400;
        handlersRec.__catchBody = args === ''
            ? `.catch(${invalidBodyHandler})`
            : `.catch(function(_){return ${invalidBodyHandler}(_,${args})})`;
    }
    // Special 400
    else if (fn400 === false) {
        handlersRec[invalidBodyHandler] = badRequestHandler;
        handlersRec.__catchBody = `.catch(${invalidBodyHandler})`;
    }

    let composedBody = '';

    // Fn 404 for default return
    if (fn404 || fn404 === false) {
        // Handle default and custom 404
        if (fn404 === false) {
            handlersRec.__defaultReturn += ` new Response(null,${nfHandler})`;
            handlersRec[nfHandler] = notFoundHeader;
        } else {
            handlersRec.__defaultReturn += ` ${nfHandler}(${checkArgs(fn404, 0)})`;
            handlersRec[nfHandler] = fn404;
        }

        composedBody = handlersRec.__defaultReturn;
    }

    // Composing nodes
    composedBody = compileNode(
        router.root, false, handlersRec,
        startIndex, false, false, null
    ) + composedBody;

    // Remove internals
    let key: string;
    for (key in handlersRec)
        if (key.startsWith('__'))
            delete handlersRec[key];

    return {
        store: handlersRec,
        fn: composedBody
    };
}
