A router for StricJS.

```typescript
import { Router, macro } from '@stricjs/router';

// Create a router and serve using Bun
export default new Router()
  // Handle GET request to `/`
  .get("/", macro("Hi"))
  // Handle POST request to `/json`
  .post("/json", ctx => Response.json(ctx.data), { body: 'json' })
  // Return 90 for requests to `/id/90` for instance
  .get("/id/:id", ctx => new Response(ctx.params.id))
  // Use the default 404 handler
  .use(404);
```

See the [docs](https://stricjs.netlify.app/#/basic/routing/main) for more details.
