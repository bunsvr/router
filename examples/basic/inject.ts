import { Router } from '../..';

export default new Router()
    // Inject is useful for plugins
    .inject('name', 'Reve')
    .get('/', ({ 
        inject: { name } 
    }) => new Response(name));