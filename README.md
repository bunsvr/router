A router middleware for BunSVR.

```typescript
import { Router } from "@bunsvr/router";

const router = new Router();

// Add a handler to route "/home"
router.static("GET", "/home", 
    () => new Response("Hello!")
);

// Return a 404 for all other routes
router.dynamic("", "/(.*)", 
    () => new Response("Not Found")
);

// Serve directly
router.serve();
```

See the docs [here](https://bunsvr.netlify.app/modules/_bunsvr_router.html).

## Benchmark
Clone the reposity. Go into the root directory and run `bun bench`.

Wait around a minute and the result will be printed in the console. 

## Algorithm
The [`Fouter`](/src/router.ts) algorithm.

### Storing handlers
Router handlers are saved into a static map for static routes and an array for dynamic routes.
```typescript
interface Fouter {
    static: Record<string, HandlerFunction>;
    regexp: [[RegExp, HandlerFunction]];
}
```

### Adding handlers
The `add(method, path, handler)` set the key `method + path` to the handler.

The `match(method, path, handler)` push an array with the RegExp path from `method + path` as the first element and the handler as the second element.

### Finding routes
Slice the pathname from the full URL using `/(?:\w+:)?\/\/[^\/]+([^?]+)/`.

Search for method-specific static handler and all-method static handler of the path. 

If found returns an array with the handler as the only element.

If there are no static handler of the path loop through the RegExp list and test the path with each RegExp. 

If match then returns an array with the handler as the first element and the `RegExpExecArray` as the second element.

If nothing matches returns an empty array.