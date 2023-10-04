import { test, expect } from 'bun:test';
import { rpc, router } from '..';

// TODO: Move to @stricjs/rpc
const names = {
    '001': '1',
    '002': '2',
    '003': '3'
};

const route = rpc.route({
    // Send JSON
    greeting: rpc
        .proc('json', d => 'name' in d ? d as { name: string } : null)
        .use(c => ({ message: `Hi ${c.data.name}` as const })),
    // Send text
    name: rpc
        .proc('text', d => d in names ? d as keyof typeof names : null)
        .use(c => names[c.data])
        .wrap('send')
});

const app = router(route)
    .set('port', 3001)
    .listen();

const client = rpc.client<typeof route>(app.details.base);

test('RPC json', async () => {
    const greeting = client.greeting.format('json'),
        res = await greeting({ name: 'john' });

    expect(res).toEqual({ message: 'Hi john' });
});

test('RPC text', async () => {
    const name = client.name.format('text'),
        res = await name('001');

    expect(res).toBe(names['001']);
})
