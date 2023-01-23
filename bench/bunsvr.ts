import { Router } from "..";

new Router()
    .static("GET", "/", 
        () => new Response("Hi"))
    .dynamic("GET", "/id/:id", 
        req => new Response(req.params[1]))
    .serve();