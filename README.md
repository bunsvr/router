An minimal, heavily-optimized router for Stric.

```typescript
import { Router, macro } from '@stricjs/router';

// Create a router and serve using Bun
export default new Router()
  // Handle GET request to `/`
  .get('/', macro('Hi'))
  // Handle POST request to `/json`
  .post('/json', ctx => ctx.data, { body: 'json', wrap: 'json' })
  // Return 90 for requests to `/id/90` for instance
  .get('/id/:id', ctx => ctx.params.id, { wrap: true })
  // Use the default 404 handler
  .use(404);
```

See the [docs](https://stricjs.netlify.app) for more details.
