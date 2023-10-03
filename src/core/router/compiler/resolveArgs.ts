import { appDetail, requestObjectName } from './constants';

// Whether to pass `ctx` and `server` to args or not
export function checkArgs(fn: Function, skips: number) {
    return fn.length > skips + 1 ? requestObjectName + ',' + appDetail : (
        fn.length > skips ? requestObjectName : ''
    );
}

