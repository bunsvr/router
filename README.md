A router for StricJS.

```typescript
import { Router } from "@stricjs/router";

// Create a router and serve using Bun
export default new Router()
  // Handle GET request to `/`
  .get("/", () => new Response("Hi"))
  // Handle POST request to `/json`
  .post("/json", async req => Response.json(await req.json()))
  // Return 90 for requests to `/id/90` for instance
  .get("/id/:id", req => new Response(req.params.id))
  // Use the default 404 handler
  .use(404);
```

## Benchmark
You can see the latest [benchmark](https://github.com/bunsvr/benchmark) result [here](https://github.com/bunsvr/benchmark/blob/main/results/index.md).

I recommend benchmarking this on your machine.
