import { Router } from '../..';

export default new Router()
    .ws('/', { 
        message(ws) { 
            ws.send('Hi'); 
        }
    })
    .get('/home', () => new Response('Hi'))
    .get('/id/:id', ({ 
        params: { id } 
    }) => new Response(id));
