import { Router } from "../..";

// A simple app
const fn = new Router()
    .get('/', () => new Response('Hi'))
    .get('/id/:id', ({ params: { id } }) => new Response(id))
    .fetch;

// Log the fetch function body
console.log(fn.toString());

