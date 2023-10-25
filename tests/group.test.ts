import { expect, test } from "bun:test";
import { Group, macro, mock, router } from "..";

const a = new Group('/a').get('/', macro('Hi')),
    b = new Group('/b').plug(a),
    c = new Group('/c').plug(b),
    app = router(c).set('port', 3001).use(404);

const client = mock(app, { logLevel: 1 });

test('Nested group', async () => {
    const res = await client.text('/c/b/a');
    expect(res).toBe('Hi');
});
