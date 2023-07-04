import { Router } from '../..';

export default new Router()
    .use('pre', req => {
        // May perform other guard here
        if (req.path === '/')
            return new Response('Hi!');
    }, true)
    .get('/:id', ({ params: { id } }) => new Response(id));