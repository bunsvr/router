import { App } from "@bunsvr/core";
import { Router } from "../..";

const app = new App();
const router = new Router(app);

// Add a handler to other routes starts with "/main" but not "/main"
router.use({
    method: "GET",
    path: "/main/*",
    async run() {
        return new Response("Hello!");
    }
});

// Register the router as a middleware
router.register();

// Returns a 404 error for other routes
app.use(async request =>
    new Response(`Cannot ${request.method} ${request.url}`, { status: 404 })
);

// Serve using Bun
export default app;