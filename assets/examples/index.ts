import { App } from "@bunsvr/core";
import { Router } from "../..";

const app = new App();
const router = new Router();

// Add a handler to other routes starts with "/main" but not "/main"
router.use({
    path: "/main/*",
    async run() {
        return new Response("Hello!");
    }
});

// Not found error
router.use({
    path: "*",
    async run(request) {
        return new Response(`Cannot ${request.method} ${request.url}`, { status: 404 });
    }
})

// Register the router as a middleware
router.register(app);

// Serve using Bun
export default app;