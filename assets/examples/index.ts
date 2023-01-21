import { Router } from "../..";

const router = new Router();

// Add a handler to other routes starts with "/main" but not "/main"
router.static("GET", "/home", () => new Response("Hello!"));

// Not found error
router.dynamic("", "/(.*)", () => new Response("Not Found"));

// Serve directly
router.serve();