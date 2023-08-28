/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { Router, macro, mock, buildFetch } from '..';

const predefinedBody = { hi: 'there' };

// Create the function;
const app = new Router({ base: 'http://localhost:3000' })
    .get('/', macro('Hi'))
    .get('/id/:id', req => new Response(req.params.id))
    .get('/:name/dashboard', req => new Response(req.params.name))
    .post('/json', req => Response.json(req.data), { body: 'json' })
    .get('/json', () => Response.json(predefinedBody))
    .get('/api/v1/hi', macro('Hi'))
    .guard('/api/v1', req => req.method === 'GET' ? null : true)
    .all('/json/*', req => new Response(req.params['*']));

const tester = mock(app),
    fn = buildFetch(tester.meta);

console.log(fn.toString());

// GET / should returns 'Hi'
test('GET /', async () => {
    const res = await tester.text('http://localhost:3000/');
    expect(res).toBe('Hi');
});

// Dynamic path test
test('GET /id/:id', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = await tester.text('http://localhost:3000/id/' + randomNum + '?param');

    expect(res).toBe(randomNum);
});

// Edge case test
test('GET /:name/dashboard', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = await tester.text('http://localhost:3000/' + randomNum + '/dashboard');

    expect(res).toBe(randomNum);
});

// JSON test
test('POST /json', async () => {
    const rnd = { value: Math.round(Math.random()) },
        res = await tester.json('http://localhost:3000/json', {
            method: 'POST',
            body: JSON.stringify(rnd)
        });

    expect(res).toStrictEqual(rnd);
});

test('404', async () => {
    let res: any = await tester.code('http://localhost:3000/path/that/does/not/exists');
    expect(res).toBe(404);

    res = await tester.text('http://localhost:3000/json/any', {
        method: 'PUT'
    });
    expect(res).toBe('any');

    res = await tester.code('http://localhost:3000/api/v1/hi');
    expect(res).toBe(404);
});

