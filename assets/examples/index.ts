import { Router } from "../..";

const router = new Router();

// Add a handler to route "/home"
router.static("GET", "/home", () => new Response("Hello!"));

// Return a 404 for all other routes
router.dynamic("", "/(.*)", () => new Response("Not Found"));

// Serve directly
router.serve();