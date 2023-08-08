export const methods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH', 'ALL', 'GUARD'];
export const methodsLowerCase = methods.map(v => v.toLowerCase());

export function convert(path: string) {
    if (path.at(-1) === '/' && path.length > 1) path = path.slice(0, -1);
    return path;
}
