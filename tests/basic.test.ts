/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { Router, macro, mock } from '..';

const predefinedBody = { hi: 'there' }, invalidBody = { status: 400 };

// Create the function;
const app = new Router({ base: 'http://localhost:3000' })
    .get('/', macro('Hi'))

    .get('/id/:id', req => new Response(req.params.id))
    .get('/:name/dashboard/:cat', req => new Response(req.params.name + ' ' + req.params.cat))

    .post('/json', ctx => Response.json(ctx.data), { body: 'json' })
    .get('/json', () => Response.json(predefinedBody))

    .get('/api/v1/hi', macro('Hi'))

    .guard('/api/v1', req => req.method === 'GET' ? null : true)
    .reject('/api/v1', () => new Response('No enter!'))

    .all('/json/*', req => new Response(req.params['*']))

    .use(404)
    .use(400, e => new Response(String(e), invalidBody));

const tester = mock(app, { logLevel: 3 });

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
    const res = await tester.code('/json', { method: 'POST' });

    expect(res).toBe(400);
});
