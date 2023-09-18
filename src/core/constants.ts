export const methods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH', 'ALL', 'GUARD', 'REJECT'];
export const methodsLowerCase = methods.map(v => v.toLowerCase());

export function convert(path: string) {
    if (path.length < 2) return path;
    if (path.at(-1) === '/') return path.substring(0, path.length - 1);
    return path;
}
