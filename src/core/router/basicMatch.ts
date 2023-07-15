import { Node, FindResult } from './types';

export default function basicMatch<T>(
    node: Node<T>,
    url: string,
    startIndex: number,
    urlLength: number
): FindResult<T> | null {
    const { part } = node, partLen = part.length, endIndex = startIndex + partLen;
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
    }

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
            const route = basicMatch(inert, url, endIndex, urlLength);
            if (route !== null) return route;
        }
    }

    if (node.params !== null) {
        const { params } = node, slashIndex = url.indexOf('/', endIndex);

        if (slashIndex !== endIndex) {
            // Params cannot be empty
            if (slashIndex === -1 || slashIndex >= urlLength) {
                if (params.store !== null) {
                    // This is much faster than using a computed property
                    const p: FindResult<T> = { _: params.store };
                    p[params.paramName] = url.substring(endIndex);
                    return p;
                }
            } else if (params.inert !== null) {
                const route = basicMatch(params.inert, url, slashIndex, urlLength);

                if (route !== null) {
                    route[params.paramName] = url.substring(endIndex, slashIndex);
                    return route;
                }
            }
        }
    }

    if (node.wildcardStore !== null)
        return { '*': url.substring(endIndex), _: node.wildcardStore };

    return null;
}
