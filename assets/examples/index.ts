import { Router } from "../..";

new Router()
    // Add a handler to route "/home"
    .static("GET", "/home", () => 
        new Response("Hello!"))
    // Return a 404 for all other routes
    .dynamic("/(.*)", () => 
        new Response("Not Found"))
    // Serve directly
    .serve();