import { test, expect } from 'bun:test';
import { rpc, router } from '..';

const sv = rpc.router({
    greeting: rpc
        // Use a type validator here
        .proc(d => 'name' in d ? d as { name: string } : null)
        .use(c => ({ message: 'Hi ' + c.data.name })),
}), app = router(sv)
    .set('port', 3001)
    .listen();

const client = rpc.client<typeof sv>(app.details.base);

test('RPC route', async () => {
    expect(
        await client.greeting({ name: 'reve' })
    ).toEqual({ message: 'Hi reve' });
});
