import { App } from "@bunsvr/core";
import { Router } from "../..";

const app = new App();

// Serve the returned app using Bun
export default new Router()
    // Add a handler to route / (All method)
    .static("", "/", () =>
        new Response("Hello!"))
    // Add a handler to dynamic route /user/:id (GET method only)
    .dynamic("GET", "/user/:id", req =>
        new Response(req.params?.[1] || ""))
    // Register as a middleware and returns the app
    .register(app)
    // Return 404 for other routes
    .use(async req =>
        new Response(
            `Cannot ${req.method} ${req.url}`,
            { status: 404 }
        ));