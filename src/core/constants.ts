export const methods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
export const methodsLowerCase = methods.map(v => v.toLowerCase());

export const methodsDecls = methods.map((v, i) => `m${i}='${v}'`).join(',');

const methodsMap: { [key: string]: string } = {};
for (let i = 0; i < methods.length; ++i) methodsMap[methods[i]] = 'm' + i;

export function createMethodDecl(methods: string[], suffix: string = ',') {
    const arr = methods.map(v => `${methodsMap[v]}='${v}'`);
    if (arr.length === 0) return '';
    return arr + suffix;
}

export { methodsMap };
