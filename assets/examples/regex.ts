import { Router } from "../..";

// Match '/a' and '/b'
const valid = /\/(a|b)/;

new Router()
    // Add a handler to route "/home"
    .static(["GET", "POST"], "/home", () => 
        new Response("Hello!"))
    // Handle path that match the RegExp
    .dynamic(valid, req =>
        new Response(req.params?.join(" ")))
    // Serve directly
    .serve();
