import { Router } from "..";

new Router()
    .static("GET", "/", 
        () => new Response("Hi"))
    .static("POST", "/json",
        async req => Response.json(await req.json()))
    .dynamic("GET", "/id/:id", 
        req => new Response(req.params?.[1]))
    .serve();