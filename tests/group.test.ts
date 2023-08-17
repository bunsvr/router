import { test, expect } from 'bun:test';
import { Router, Group, macro } from '..';

const base = 'http://localhost:3000', forbid = { status: 403 };

const basic = new Group().get('/', macro('Hi client!')),
    admin = new Group('/admin')
        .guard('/', req => req.method === 'POST' || null)
        .reject('/', () => new Response('Access denied', forbid))
        .post('/json', req => Response.json(req.data), { body: 'json' });

const app = new Router().plug(basic, admin).use(404),
    fn = app.fetch;
console.log(fn.toString());

test('Basic', async () => {
    const res = fn(new Request(base + '/'));
    expect(await res.text()).toBe('Hi client!');
});

const data = { value: Math.round(Math.random() * 10) + 1 };

test('JSON', async () => {
    const res = await fn(
        new Request(base + '/admin/json', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
});

test('Forbidden', async () => {
    const res = fn(new Request(base + '/admin/json'));

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Access denied');
});
