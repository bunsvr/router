import { macro, router } from '..';

router()
    .get('/', macro('Hi'))
    .get('/id/:id', c => new Response(c.params.id))
    // Properties are set to default value to improve performance
    .get('/debug', c => new Response('data' in c ? 'Optimizations on' : ''))
    .listen();

