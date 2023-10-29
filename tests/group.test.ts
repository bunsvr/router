import { expect, test } from "bun:test";
import { Group, mock, router, route } from "..";

const a = route.get('/a', () => 'Hi', { wrap: 'send' }),
    b = new Group('/b').plug(a),
    c = new Group('/c').plug(b),
    app = router(c).set('port', 3001).use(404);

const client = mock(app, { logLevel: 1 });

test('Nested group', async () => {
    const res = await client.text('/c/b/a');
    expect(res).toBe('Hi');
});
