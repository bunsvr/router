import { Router } from '../..';

export default new Router()
    // Inject is useful for plugins
    .store('name', 'Reve')
    .get('/', (_, store) => new Response(store.name))
    .get('/change/:name', (req, store) => store.name = req.params.name);
