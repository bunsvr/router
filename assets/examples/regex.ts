import { Router } from "../..";

// Match '/a' and '/b'
const valid = /\/(a|b)/;

new Router()
    // Handle path that match the RegExp
    .dynamic("", valid, () =>
        new Response("Hello!"))
    .serve();
