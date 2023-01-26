A router middleware for BunSVR.

```typescript
import { Router } from "@bunsvr/router";

new Router()
    // Add a handler to route "/home"
    .static("GET", "/home", () => 
        new Response("Hello!"))
    // Return a 404 for all other routes
    .dynamic("", "/(.*)", () => 
        new Response("Not Found"))
    // Serve directly
    .serve();
```

See the docs [here](https://bunsvr.netlify.app/modules/_bunsvr_router.html).

## Benchmark
You can see the latest [benchmark](https://github.com/bunsvr/benchmark) result [here](https://github.com/bunsvr/benchmark/blob/main/results.md).

I recommend benchmarking this on your machine.

## Algorithm
The routing algorithm.

### Storing handlers
Router handlers are saved into a static map for static routes and an array for dynamic routes.
```typescript
class Router {
    private statics: Record<string, HandlerFunction>;
    private regexs: [RegExp, HandlerFunction][];
}
```

### Adding handlers
The `static(method, path, handler)` set the key `method + path` in `Router.statics` object to the handler.

The `dynamic(method, path, handler)` push an array with the RegExp path from `method + path` as the first element and the handler as the second element to `Router.regexs`.

### Finding routes
Slice the pathname from the full URL using `/(?:\w+:)?\/\/[^\/]+([^?]+)/`.

Search for method-specific static handler and all-method static handler of the path. 

If found returns an array with the handler as the only element.

If there are no static handler of the path loop through the RegExp list and test the path with each RegExp. 

If match then returns an array with the handler as the first element and the `RegExpExecArray` as the second element.

If nothing matches returns an empty array.

## Note
This is still experimental.

Stable versions:
- 0.0.14
- 0.0.15