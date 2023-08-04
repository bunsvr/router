import { Router, macro } from '../..';

const toRes = Response.json;

const fn = new Router({ base: 'http://localhost:3000' })
    .get('/', macro(() => new Response('Hi')))
    .post('/json', req => req.json().then(toRes))
    .get('/id/:id', req => new Response(req.params.id))
    .use(404)
    .fetch;

console.log(fn.toString());
export default { fetch: fn };
