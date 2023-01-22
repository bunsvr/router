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