const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

export default {
    async fetch(req: Request) {
        let path = (urlSlicer.exec(req.url) as RegExpExecArray)[1];
        
        // Path '/'
        if (path === "/")
            return new Response("Hi");

        // Path '/json'
        if (path === "/json")
            return Response.json(await req.json());
        
        // Path '/id/:id'
        if (path.startsWith("/id/")) {
            path = path.slice(4);
                
            if (path.indexOf("/") < 0)
                return new Response(path);
        }

        return new Response("", { status: 404 });
    }
}