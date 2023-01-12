A router based on [Trouter](https://github.com/lukeed/trouter). Can be used as a BunSVR app middleware or served directly.
```typescript
import { Router } from "../..";

const router = new Router();

// Add a handler to other routes starts with "/main" but not "/main"
router.use({
    path: "/main/*",
    run: () => new Response("Hello!"),
});

// Serve directly
router.serve();
```
See the example [here](/assets/examples/index.ts).