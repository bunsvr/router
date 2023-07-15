/// <reference types='bun-types' />
import { test, expect } from 'bun:test';
import { Router } from '..';

const stringify = JSON.stringify,
    jsonOpts = { headers: { 'Content-Type': 'application/json' } };
function toResponse(json: any) {
    return new Response(stringify(json), jsonOpts);
}

// Create the function;
const app = new Router({ base: 'http://localhost:3000' })
    .get('/', () => new Response('Hi'))
    .get('/id/:id', ({ params: { id } }) => new Response(id))
    .get('/:name/dashboard', ({ params: { name } }) => new Response(name))
    .post('/json', req => req.json().then(toResponse));

const fn = app.fetch;
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
