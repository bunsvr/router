import { Router } from "../..";

new Router()
    // Add a handler to route "/home"
    .static(["GET", "POST"], "/home", () => 
        new Response("Hello!"))
    // Handle path that match the RegExp
    .dynamic("GET", "/user/:id", req =>
        new Response(req.params.groups.id))
    // Serve directly
    .serve();
