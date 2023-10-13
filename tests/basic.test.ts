/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { macro, mock, router, wrap } from '..';

const predefinedBody = { hi: 'there' }, invalidBody = { status: 400 };

// Create the function;
const app = router()
    .set('port', 3000)
    .get('/', macro('Hi'))

    .get('/id/:id', c => new Response(c.params.id))
    .get('/:name/dashboard/:cat', c => new Response(c.params.name + ' ' + c.params.cat))

    .post('/json', c => wrap.json(c.data), { body: 'json' })
    .all('/json', () => wrap.json(predefinedBody))

    .get('/api/v1/hi', () => 'Hi')

    .guard('/api/v1', async c => c.method === 'GET' ? null : true)
    .reject('/api/v1', () => 'No enter!')
    .wrap('/api/v1')

    .all('/json/*', c => new Response(c.params['*']))

    .get('/str/1', () => 'Hello')
    .get('/str/2', async () => 'Hi')
    .get('/str/3', (_, meta) => meta.server.port)

    .get('/str/4', c => {
        c.set = { status: 418 };
        return 'I\'m a teapot';
    })

    .get('/str/5', macro(10))
    .wrap('/str', 'send')

    .use(404)
    .use(400, (e, c) => new Response(c.url + ': ' + e, invalidBody));

// Tracking time
console.time('Build fetch');
console.log(app.meta);

// Report process memory usage and build time 
console.timeEnd('Build fetch');

const tester = mock(app, { logLevel: 1 });
console.log(process.memoryUsage());

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
