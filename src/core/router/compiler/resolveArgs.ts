import { appDetail, requestObjectName } from './constants';

export function extractArgs(fn: Function) {
    let str = fn.toString(),
        st = str.indexOf('('),
        ed = str.indexOf(')', st + 1);

    return str.substring(st, ed);
}

// Whether to pass `ctx` and `server` to args or not
export function checkArgs(str: string | Function, skips: number) {
    if (typeof str !== 'string') str = extractArgs(str);
    if (str.length === 0) return '';

    let i = str.indexOf(',');
    while (skips !== 0) {
        if (i === -1) return '';
        i = str.indexOf(',', i + 2);

        --skips;
    }

    return i === -1
        ? requestObjectName
        : requestObjectName + ',' + appDetail;
}

