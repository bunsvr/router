import { Router } from '../..';

export default new Router()
    // Add a handler to route '/'
    .get('/', () => new Response('Hi'))
    .get('/id/:id', ({ params: { id } }) => new Response(id));
