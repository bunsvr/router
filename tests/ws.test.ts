import { mock, router, ws } from '..';
import { test, expect } from 'bun:test';

const route = ws.route({
    message(ws) {
        ws.send('Hi');
    }
}, true), app = router()
    .set('port', 3002)
    .all('/', c => route.upgrade(c))
    .listen()
    .plug(route);

const client = mock(app);

test('WS', done => {
    const socket = client.ws('/');

    socket.onopen = () => socket.send('');
    socket.onmessage = m => {
        expect(m.data).toBe('Hi');
        done();
    }
});
