/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { Router, macro, mock } from '..';

const predefinedBody = { hi: 'there' }, invalidBody = { status: 400 };

// Create the function;
const app = new Router()
    .get('/', macro('Hi'))

    .get('/id/:id', req => new Response(req.params.id))
    .get('/:name/dashboard/:cat', req => new Response(req.params.name + ' ' + req.params.cat))

    .post('/json', ctx => Response.json(ctx.data), { body: 'json' })
    .get('/json', () => Response.json(predefinedBody))

    .get('/api/v1/hi', () => 'Hi')

    .guard('/api/v1', async req => req.method === 'GET' ? null : true)
    .reject('/api/v1', () => 'No enter!')
    .wrap('/api/v1')

    .all('/json/*', req => new Response(req.params['*']))

    .get('/str/1', () => 'Hello')
    .get('/str/2', async () => 'Hi')
    .get('/str/3', (_, server) => server.port)

    .get('/str/4', c => {
        c.status = 418;
        return 'I\'m a teapot';
    }, { wrap: 'send' })

    .get('/str/5', macro(10))
    .wrap('/str')

    .use(404)
    .use(400, (e, c) => new Response(c.url + ': ' + e, invalidBody));

console.time('Build fetch');
const tester = mock(app, { logLevel: 2 });

// Report process memory usage and build time
console.log(process.memoryUsage());
console.timeEnd('Build fetch');

// GET / should returns 'Hi'
test('GET /', async () => {
    const res = await tester.text('/');
    expect(res).toBe('Hi');
});

// Dynamic path test
test('GET /id/:id', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = await tester.text(`/id/${randomNum}?param`);

    expect(res).toBe(randomNum);
});

// Edge case test
test('GET /:name/dashboard/:cat', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = await tester.text(`/${randomNum}/dashboard/main`);

    expect(res).toBe(randomNum + ' main');
});

// JSON test
test('POST /json', async () => {
    const rnd = { value: Math.round(Math.random()) },
        res = await tester.json('/json', {
            method: 'POST',
            body: rnd
        });

    expect(res).toStrictEqual(rnd);
});

test('404', async () => {
    let res: any = await tester.code('/path/that/does/not/exists');
    expect(res).toBe(404);

    res = await tester.text('/json/any', { method: 'PUT' });
    expect(res).toBe('any');

    res = await tester.text('/api/v1/hi');
    expect(res).toBe('No enter!');
});

test('400', async () => {
    const res = await tester.fetch('/json', { method: 'POST' });

    expect(res.status).toBe(400);
    console.log(await res.text());
});

test('Wrapper', async () => {
    let res: any = await tester.text('/str/1');
    expect(res).toBe('Hello');

    res = await tester.text('/str/2');
    expect(res).toBe('Hi');

    res = await tester.text('/str/3');
    expect(res).toBe('3000');

    res = await tester.fetch('/str/4');
    expect(await res.text()).toBe(`I'm a teapot`);
    expect(res.status).toBe(418);

    res = await tester.text('/str/5');
    expect(res).toBe('10');
});
