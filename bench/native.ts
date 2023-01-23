const urlSlicer = /(?:\w+:)?\/\/[^\/]+([^?]+)/;

export default {
    fetch(req: Request) {
        const path = (urlSlicer.exec(req.url) as RegExpExecArray)[1].slice(1);
        
        // Path '/'
        if (path === "")
            return new Response("Hi");
        
        if (path.includes("/"))
            return new Response("", { status: 404 });

        return new Response(path);
    }
}