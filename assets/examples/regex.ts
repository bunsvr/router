import { Router } from "../..";

// Match '/a' and '/b'
const valid = /\/(a|b)/;

const router = new Router()
    // Add a handler to route "/home"
    .static(["GET", "POST"], "/home", () => 
        new Response("Hello!"))
    // Handle path that match the RegExp
    .dynamic(["GET", "DELETE"], valid, req =>
        new Response(req.params.join(" ")))
    
console.log(router)

router// Serve directly
.serve();
