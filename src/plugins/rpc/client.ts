function EmptyObject() { };
EmptyObject.prototype = Object.create(null);

const toJSON = (r: Response) => r.status === 400 ? null : r.json(), { stringify } = JSON;

export default function client(root: string) {
    if (root.at(-1) !== '/') root += '/';

    return new Proxy(new EmptyObject, {
        get(target, p) {
            // Implement caching
            if (p in target) return target[p];

            const path = root + String(p),
                // A fetch client
                fn = (b: any) => fetch(path, {
                    method: 'POST',
                    body: stringify(b)
                }).then(toJSON);

            target[p] = fn;
            return fn;
        },
    })
}
