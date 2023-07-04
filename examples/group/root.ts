import { Router, Group } from '../..';

// IDs
const idList = {
    '0': 'a',
    '1': 'b',
    '2': 'c'
};

// Response stuff
const notFound = { status: 404 };
const msg = 'Welcome! Go to /search/:id to search for specific IDs';
const group = new Group('/search')
    .get('/:id', ({ params: { id } }) => {
        const item = idList[id];
        if (item === undefined)
            return new Response('Item not found', notFound);
        return new Response(idList[id]);
    });

// Router
export default new Router()
    .plug(group)
    .get('/', () => new Response(msg));