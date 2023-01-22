import { App } from "@bunsvr/core";
import { Router } from "../..";

const router = new Router();
const app = new App();

// Add a handler to route / (All method)
router.static("", "/", () =>
    new Response("Hello!")
);

// Add a handler to dynamic route /user/:id (GET method only)
router.dynamic("GET", "/user/:id", (req, server, params) => 
    new Response(params ? params.join(" ") : "")
)

// Register as a middleware
router.register(app);

// Return 404 for other routes
app.use(async req => 
    new Response(`Cannot ${req.method} ${req.url}`, { status: 404 })
);

export default app;