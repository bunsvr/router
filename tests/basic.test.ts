/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { Router, macro } from '..';

const stringify = JSON.stringify;

// Create the function;
const app = new Router({ base: 'http://localhost:3000' })
    .get('/', macro('Hi'))
    .get('/id/:id', req => new Response(req.params.id))
    .get('/:name/dashboard', req => new Response(req.params.name))
    .post('/json', req => Response.json(req.data), { body: 'json' })
    .get('/api/v1/hi', macro('Hi'))
    .guard('/api/v1', req => req.method === 'GET' ? null : true)
    .all('/json', macro('ayo wrong method lol'));

const fn = app.fetch as any;
console.log(fn.toString());
    
// GET / should returns 'Hi'
test('GET /', async () => {
    const res = fn(new Request('http://localhost:3000/')) as Response;
    expect(await res.text()).toBe('Hi');
});

// Dynamic path test
test('GET /id/:id', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = fn(new Request('http://localhost:3000/id/' + randomNum));
    
    expect(await res.text()).toBe(randomNum);
});

// Edge case test
test('GET /:name/dashboard', async () => {
    const randomNum = String(Math.round(Math.random() * 101)),
        res = fn(new Request('http://localhost:3000/' + randomNum + '/dashboard'));

    expect(await res.text()).toBe(randomNum);
});

// JSON test
test('POST /json', async () => {
    const rnd = { value: Math.round(Math.random()) },
        res = await fn(new Request('http://localhost:3000/json', {
            method: 'POST',
            body: stringify(rnd)
        }));

    expect(await res.json()).toStrictEqual(rnd);
});

test('404', async () => {
    let res = fn(new Request('http://localhost:3000/path/that/does/not/exists')) as Response;
    expect(res).toBe(undefined);

    res = fn(new Request('http://localhost:3000/json')) as Response;
    expect(await res.text()).toBe('ayo wrong method lol');

    res = await fn(new Request('http://localhost:3000/api/v1/hi')) as Response;
    expect(res).toBeNil();
});

