import { Router } from '../..';

const app = new Router()
    .get('/', () => new Response('Hi'));

// Should be used when the number of static routes are large
app.useVM = !!process.argv[2];
export default app;
