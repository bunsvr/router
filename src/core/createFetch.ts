import { StaticRoute } from './types';

type PathHandler = {
    method: string,
    index: number,
    ws: number,
};
type HandlerObject = {
    [path: string]: PathHandler[]
};

// n: The 404 response option
// f: The function to search for the route
// method: The request method
// p: The parsed request pathname
// h: The custom 404 handler
// r: The request
// t: The pre-handler
// b: The pre-handler result
// i: The inject object
// x: The wshandler
// q: list of data match on index of WS handlers
// url: The request URL
// s: Start index of path
// e: Query start index
// c: Prefix for other handlers of static routes
// w: Prefix for websocket data
const handleRoute = (returnStatement: string) => `const o=f(method,p);if(o===null)${returnStatement}r.params=o;return o._(r);`;

function isAsync(func: Function) {
    return func && func.constructor.name === 'AsyncFunction';
}

function getWSHandler(wsIndex: number | string) {
    if (typeof wsIndex === 'number')
        wsIndex = 'w' + wsIndex;
    else 
        wsIndex = `q[${wsIndex}]`;
    return `if(this.upgrade(r,${wsIndex}))return;`;
}

function getSwitchHandler(item: PathHandler) {
    return item.ws === -1 ? `return c${item.index}(r);` : getWSHandler(item.ws);
}

function checkMethods(list: PathHandler[], returnStatement: string) {
    if (list.length === 1) {
        const { method, ws: wsIndex, index } = list[0];

        if (wsIndex === -1)
            return `if(method==='${method}')return c${index}(r);${returnStatement}`;

        return `return this.upgrade(r,w${wsIndex});`;
    }
    return `switch(method){${list.map(item => `case '${item.method}':${getSwitchHandler(item)}`)}default:${returnStatement}}`;
}

function getHandler(path: string, method: string) {
    return `app.static['${path}']['${method}']`;
}

function searchHandler(routes: StaticRoute) {
    const hs: HandlerObject = {};
    let index = 0;
    for (const path in routes) {
        const pathHandlers = routes[path];

        for (const method in pathHandlers) {
            if (!hs[path])
                hs[path] = [];

            let ws = -1;
            if (typeof pathHandlers[method] === 'number')
                ws = pathHandlers[method] as number;

            hs[path].push({ method, index, ws });
            ++index;
        }
    }

    return hs;
}

const default404 = ' new Response(null,n)';
function createFetchBody(app: any) {
    const routes = app.static as StaticRoute;
    const routerExists = !!app.router;

    // If the app does registers a 404 handler change the return statement
    // app.fn404 is false when a handler is not set but use(404) is called
    let returnStatement = 'return';
    if (app.fn404 === false)
        returnStatement += default404;
    else if (app.fn404)
        returnStatement += ' h(r)';
    returnStatement += ';';

    // Search handlers
    const handlers = searchHandler(routes);
    let fnSetLiteral = '', fnWSLiteral = '';
    const wsExists = !!app.webSocketHandlers;
    for (const path in handlers)
        for (const item of handlers[path]) {
            fnSetLiteral += `c${item.index}=${getHandler(path, item.method)},`;
            if (item.ws !== -1) 
                fnWSLiteral += `w${item.index}={data:x[${item.index}]},`
        }

    // Paths
    const paths = Object.keys(routes);

    // Switch literal
    let fnSwitchLiteral = '';
    for (const path of paths)
        fnSwitchLiteral += `case'${path}':${checkMethods(handlers[path], returnStatement)}`;

    const preHandlerPrefix = isAsync(app.fnPre) ? 'await ' : '';
    const switchStatement = fnSwitchLiteral === ''
        ? (
            routerExists
                ? handleRoute(returnStatement)
                : returnStatement
        ) : `switch(p){${fnSwitchLiteral}default:${routerExists ? handleRoute(returnStatement) : returnStatement}}`;

    // All variables are in here
    let declarationLiteral = `${fnSetLiteral}${app.fn404 ? `h=app.fn404,` : ''}${app.fn404 === false ? 'n={status:404},' : ''}${app.router ? `f=app.router.find.bind(app.router),` : ''}${app.fnPre ? 't=app.fnPre,' : ''}${app.injects ? 'i=app.injects,' : ''}${wsExists ? 'x=app.webSocketHandlers,' : ''}${fnWSLiteral}`;
    if (declarationLiteral !== '')  
        declarationLiteral = 'const ' + declarationLiteral.slice(0, -1) + ';';

    const fnBody = `${declarationLiteral}return ${isAsync(app.fnPre) ? 'async ' : ''}function(r){const{url,method}=r,s=url.indexOf('/',12),e=url.indexOf('?',s+1),p=e===-1?url.substring(s):url.substring(s,e);r.query=e;r.path=p;${app.injects ? 'r.inject=i;' : ''}${app.fnPre 
    ? (app.fnPre.response
        ? `const b=${preHandlerPrefix}t(r);if(b!==undefined)return b;`
        : `if(${preHandlerPrefix}t(r)!==undefined)${returnStatement}`
    ) : ''
    }${switchStatement}}`;

    // Create function body
    return fnBody;
};

const exec = globalThis.process && await import('vm').then(i => i.runInNewContext);
/**
 * Create fetch function for Deno and Cloudflare workers
 * @param app 
 */
export function createFetch(app: any) {
    const body = createFetchBody(app);

    if (app.useVM && exec)
        return exec(`(app${app.fn404 === false ? ',Response' : ''}) => {${body}}`)(app, Response);
    return Function('app', body)(app);
}

export function createWSHandler(name: string) {
    let argsList = 'w';
    if (name === 'message')
        argsList += ',m';
    if (name === 'close')
        argsList += ',c,m';
    const body = `return function(${argsList}){const i=w.data.${name};if(i!==null)i(${argsList})}`;
    return Function(body)();
}
