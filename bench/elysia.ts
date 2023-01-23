import Elysia from "elysia";

new Elysia()
    .get("/", () => "Hi")
    .get("/:id", c => c.params.id)
    .listen(3000);
