import { Router } from '../..';

const badRequest = { status: 400 };

const app = new Router()
    // Add a handler to route '/'
    .get('/', () => new Response('Hi'))
    .get('/id/:id', ({ params: { id } }) => new Response(id))
    .get('/ws', req => server.upgrade(req) || new Response(null, badRequest));

app.websocket = { 
    message: (ws, msg) => {
        ws.send(msg);
    } 
};

app.ls();

