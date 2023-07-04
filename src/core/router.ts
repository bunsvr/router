const methods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];

interface FindResult<T> extends Record<string, any> {
    '_': T
};

export interface ParamNode<T> {
    paramName: string
    store: T | null
    inert: Node<T> | null
}

export interface Node<T> {
    part: string
    store: T | null
    inert: Map<number, Node<T>> | null
    params: ParamNode<T> | null
    wildcardStore: T | null
}

const createNode = <T>(part: string, inert?: Node<T>[]): Node<T> => ({
    part,
    store: null,
    inert:
        inert !== undefined
            ? new Map(inert.map((child) => [child.part.charCodeAt(0), child]))
            : null,
    params: null,
    wildcardStore: null
});

const cloneNode = <T>(node: Node<T>, part: string) => ({
    ...node,
    part
});

const createParamNode = <T>(paramName: string): ParamNode<T> => ({
    paramName,
    store: null,
    inert: null
});

export class Radx<T> {
    root: Record<string, Node<T>> = {};

    private static regex = {
        static: /:.+?(?=\/|$)/,
        params: /:.+?(?=\/|$)/g
    };

    constructor() {
        for (const method of methods)
            this.root[method] = null;
    }

    add(method: string, path: string, store: T): FindResult<T>[0] {
        if (typeof path !== 'string')
            throw new TypeError('Route path must be a string');

        if (path === '') path = '/';
        else if (path[0] !== '/') path = `/${path}`;

        const isWildcard = path[path.length - 1] === '*';
        if (isWildcard) {
            // Slice off trailing '*'
            path = path.slice(0, -1);
        }

        const inertParts = path.split(Radx.regex.static);
        const paramParts = path.match(Radx.regex.params) || [];

        if (inertParts[inertParts.length - 1] === '') inertParts.pop();

        let node: Node<T>;

        if (this.root[method] === null) node = this.root[method] = createNode<T>('/');
        else node = this.root[method];

        let paramPartsIndex = 0;
        for (let i = 0; i < inertParts.length; ++i) {
            let part = inertParts[i];

            if (i > 0) {
                // Set param on the node
                const param = paramParts[paramPartsIndex++].slice(1);

                if (node.params === null) node.params = createParamNode(param);
                else if (node.params.paramName !== param)
                    throw new Error(
                        `Cannot create route "${path}" with parameter "${param}" ` +
                        'because a route already exists with a different parameter name ' +
                        `("${node.params.paramName}") in the same location`
                    );

                const params = node.params;
                if (params.inert === null) {
                    node = params.inert = createNode(part);
                    continue;
                };

                node = params.inert;
            }

            for (let j = 0; ;) {
                if (j === part.length) {
                    if (j < node.part.length) {
                        // Move the current node down
                        const childNode = cloneNode(node, node.part.slice(j))
                        Object.assign(node, createNode(part, [childNode]))
                    }
                    break
                }

                if (j === node.part.length) {
                    // Add static child
                    if (node.inert === null) node.inert = new Map();
                    else if (node.inert.has(part.charCodeAt(j))) {
                        // Re-run loop with existing static node
                        node = node.inert.get(part.charCodeAt(j));
                        part = part.slice(j);
                        j = 0;
                        continue;
                    }

                    // Create new node
                    const childNode = createNode<T>(part.slice(j));
                    node.inert.set(part.charCodeAt(j), childNode);
                    node = childNode;
                    break;
                }
                if (part[j] !== node.part[j]) {
                    // Split the node
                    const existingChild = cloneNode(node, node.part.slice(j));
                    const newChild = createNode<T>(part.slice(j));

                    Object.assign(
                        node,
                        createNode(node.part.slice(0, j), [
                            existingChild,
                            newChild
                        ])
                    )
                    node = newChild;
                    break;
                }
                ++j;
            }
        }

        if (paramPartsIndex < paramParts.length) {
            // The final part is a parameter
            const param = paramParts[paramPartsIndex];
            const paramName = param.slice(1);

            if (node.params === null) node.params = createParamNode(paramName);
            else if (node.params.paramName !== paramName)
                throw new Error(
                    `Cannot create route "${path}" with parameter "${paramName}" ` +
                    'because a route already exists with a different parameter name ' +
                    `("${node.params.paramName}") in the same location`
                );

            if (node.params.store === null) node.params.store = store;
            return node.params.store;
        }

        if (isWildcard) {
            // The final part is a wildcard
            if (node.wildcardStore === null) node.wildcardStore = store;
            return node.wildcardStore
        }

        // The final part is static
        if (node.store === null) node.store = store;
        return node.store;
    }

    find(method: string, url: string): FindResult<T> | null {
        const root = this.root[method];
        if (root === null) return null;
        return matchRoute(url, url.length, root, 0);
    }
}

const matchRoute = <T>(
    url: string,
    urlLength: number,
    node: Node<T>,
    startIndex: number
): FindResult<T> | null => {
    const part = node.part, partLen = part.length, endIndex = startIndex + partLen;
    // Only check the pathPart if its length is > 1 since the parent has
    // already checked that the url matches the first character
    if (partLen > 1) {
        if (endIndex > urlLength) return null;
        if (partLen < 15) {
            let i = 1, j = startIndex + 1;
            // Using a loop is faster for short strings
            while (i < partLen) {
                if (part[i] === url[j]) { ++i; ++j; }
                else return null;
            }
        } else if (url.substring(startIndex, endIndex) !== part) return null;
    };

    if (endIndex === urlLength) {
        // Reached the end of the URL
        if (node.store !== null)
            return { _: node.store };

        if (node.wildcardStore !== null)
            return {
                _: node.wildcardStore,
                '*': ''
            };

        return null;
    }

    if (node.inert !== null) {
        const inert = node.inert.get(url.charCodeAt(endIndex));
        if (inert !== undefined) {
            const route = matchRoute(url, urlLength, inert, endIndex);
            if (route !== null) return route;
        }
    }

    if (node.params !== null) {
        const param = node.params, slashIndex = url.indexOf('/', endIndex);

        if (slashIndex !== endIndex) {
            // Params cannot be empty
            if (slashIndex === -1 || slashIndex >= urlLength) {
                if (param.store !== null) {
                    // This is much faster than using a computed property
                    const p: FindResult<T> = { _: param.store };
                    p[param.paramName] = url.substring(endIndex, urlLength);
                    return p;
                }
            } else if (param.inert !== null) {
                const route = matchRoute(url, urlLength, param.inert, slashIndex);

                if (route !== null) {
                    route[param.paramName] = url.substring(
                        endIndex,
                        slashIndex
                    );
                    return route;
                }
            }
        }
    }

    if (node.wildcardStore !== null)
        return { '*': url.substring(endIndex, urlLength), _: node.wildcardStore };

    return null;
}

export default Radx;
