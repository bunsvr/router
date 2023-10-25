import Router from "../core/main";

class ResponseStatus {
    constructor(public code: number, public text: string) { }
}

const toTxT = (r: Response) => r.text(),
    toJSON = (r: Response) => r.json(),
    toBlob = (r: Response) => r.blob(),
    toForm = (r: Response) => r.formData(),
    toBuffer = (r: Response) => r.arrayBuffer(),
    getStatus = (r: Response) => new ResponseStatus(r.status, r.statusText),
    getStatusCode = (r: Response) => r.status,
    getStatusText = (r: Response) => r.statusText,
    getHeaders = (r: Response) => r.headers,
    responseIsOk = (r: Response) => r.ok;

type Params = [url: string, init?: Omit<RequestInit, 'body'> & { body?: BodyInit | Dict<any> }];

export interface MockOptions {
    /**
     * Represent the log level 
     * `0`: No logging. This is the default value
     * `1`: Log only path 
     */
    logLevel?: 0 | 1;
}

/**
 * Create a tester for the current router
 */
export function mock(app: Router, opts: MockOptions = {}) {
    if (!app.listening) app.listen();
    const { logLevel: logLvl = 0 } = opts, base = app.details.base;

    return {
        /**
         * Create a WS client based on the path
         */
        ws(path: string | URL, opts?: ConstructorParameters<typeof WebSocket>[1]) {
            path = base + path;
            return new WebSocket(path, opts);
        },
        /**
         * Mock the current fetch handler.
         *
         * If a non-response object is returned, an empty 404 response is returned instead
         */
        async fetch(...args: Params): Promise<Response> {
            if (logLvl >= 1) console.info('Testing', '`' + args[0] + '`');
            args[0] = base + args[0];

            // Automatically stringify the body if body is JSON
            if (args[1]?.body) {
                const b = args[1].body as any;
                if (typeof b === 'object')
                    if (b.toString === Object.prototype.toString)
                        // @ts-ignore
                        args[1].body = JSON.stringify(b);
            }

            // @ts-ignore Save microticks
            return await fetch(new Request(...args));
        },

        /**
         * Mock a request and return the status message
         */
        async head(...args: Params): Promise<Headers> {
            return this.fetch(...args).then(getHeaders);
        },

        /**
         * Mock a request and convert the response to an ArrayBuffer
         */
        async ok(...args: Params): Promise<boolean> {
            return this.fetch(...args).then(responseIsOk);
        },

        /**
         * Mock a request and return the status message
         */
        async msg(...args: Params): Promise<string> {
            return this.fetch(...args).then(getStatusText);
        },

        /**
         * Mock a request and get the status code and message
         */
        async stat(...args: Params): Promise<ResponseStatus> {
            return this.fetch(...args).then(getStatus);
        },

        /**
         * Mock a request and get the status code
         */
        async code(...args: Params): Promise<number> {
            return this.fetch(...args).then(getStatusCode);
        },

        /**
         * Mock a request and convert the response to string
         */
        async text(...args: Params): Promise<string> {
            return this.fetch(...args).then(toTxT);
        },

        /**
         * Mock a request and convert the response to JSON
         */
        async json<T = any>(...args: Params): Promise<T> {
            return this.fetch(...args).then(toJSON);
        },

        /**
         * Mock a request and convert the response to Blob
         */
        async blob(...args: Params): Promise<Blob> {
            return this.fetch(...args).then(toBlob);
        },

        /**
         * Mock a request and convert the response to form data
         */
        async form(...args: Params): Promise<FormData> {
            return this.fetch(...args).then(toForm);
        },

        /**
         * Mock a request and convert the response to an ArrayBuffer
         */
        async buf(...args: Params): Promise<ArrayBuffer> {
            return this.fetch(...args).then(toBuffer);
        }
    }
}
