import type { BodyParser } from "../../core/main";

function EmptyObject() { };
EmptyObject.prototype = Object.create(null);

const { stringify } = JSON, handlerMap: {
    [K in BodyParser]: (r: Response) => any
} = {
    json: r => r.json(),
    text: r => r.text(),
    form: r => r.formData(),
    blob: r => r.blob(),
    buffer: r => r.arrayBuffer(),
    none: null
};

function createClient(path: string) {
    let format: BodyParser = 'json';
    const fn = (b: any) => fetch(path, {
        method: 'POST',
        body: typeof b === 'object' ? stringify(b) : b
    }).then(handlerMap[format]);

    fn.format = (f: string) => {
        // @ts-ignore
        format = f;
        return fn;
    }

    return fn;
}

export default function client(root: string) {
    if (root.at(-1) !== '/') root += '/';

    return new Proxy(new EmptyObject, {
        get(target, p) {
            // Implement caching
            if (p in target) return Reflect.get(target, p);

            const fn = createClient(root + (p as string));
            target[p] = fn;

            return fn;
        },
    })
}
