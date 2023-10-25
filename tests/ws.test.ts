import { mock, router, ws } from '..';
import { test } from 'bun:test';

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

    socket.addEventListener('open', () => socket.send(''));
    socket.addEventListener('message', m => m.data === 'Hi' ? done() : done(m.data));
});
