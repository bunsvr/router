import { test, expect } from 'bun:test';
import { Router, Group, macro } from '..';

const base = 'http://localhost:3000';

const basic = new Group().get('/', macro('Hi client!')),
    admin = new Group('/admin')
        .guard('/', req => req.method === 'POST' || null)
        .post('/json', req => Response.json(req.data), { body: 'json' });

const app = new Router({ base }).plug(basic, admin).use(404), 
    fn = app.fetch;
console.log(fn.toString());

test('Basic', async () => {
    const res = fn(new Request(base + '/'), undefined);
    expect(await res.text()).toBe('Hi client!');
});

const data = { value: Math.round(Math.random() * 10) + 1 };

test('JSON', async () => {
    const res = await fn(
        new Request(base + '/admin/json', {
            method: 'POST',
            body: JSON.stringify(data)
        }), undefined
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
});

test('404', () => {
    const res = fn(new Request(base + '/admin/json'), undefined);

    expect(res.status).toBe(404);
});
