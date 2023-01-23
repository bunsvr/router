const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

export default {
    fetch(req: Request) {
        let path = (urlSlicer.exec(req.url) as RegExpExecArray)[1];
        
        // Path '/'
        if (path === "/")
            return new Response("Hi");
        
        // Path /id/:id
        if (path.startsWith("/id/")) {
            path = path.slice(4);
                
            if (path.indexOf("/") > -1)
                return new Response("", { status: 404 });

            return new Response(path);
        }

        return new Response("", { status: 404 });
    }
}