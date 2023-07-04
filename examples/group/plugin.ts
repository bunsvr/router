import { Router, Group } from '../..';

const group = new Group()
    // Add plugin
    .plug(app => app.inject('name', 'Reve'))

// Router
export default new Router()
    .plug(group)
    .get('/', ({ inject: { name } }) => new Response(name));