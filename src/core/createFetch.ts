import { StaticRoute } from './types';

type PathHandler = {
    method: string,
    index: number,
    ws: number
};
type HandlerObject = {
    [path: string]: PathHandler[]
};

// n: The 404 response option
// f: The function to search for the route
// method: The request method
// h: The custom 404 handler
// r: The request
// t: The pre-handler
// b: The pre-handler result
// i: The inject object
// q: list of data match on index of WS handlers
// url: The request URL
// s: Start index of path
// c: Prefix for other handlers of static routes
// w: Prefix for websocket data
const handleRoute = (returnStatement: string) => `const o=f(method,r.path);if(o===null)${returnStatement}r.params=o;return o._(r);`;

function isAsync(func: Function) {
    return func && func.constructor.name === 'AsyncFunction';
}

function getWSHandler(wsIndex: number | string) {
    if (typeof wsIndex === 'number')
        wsIndex = 'w' + wsIndex;
    else 
        wsIndex = `q[${wsIndex}]`;
    return `{r._=${wsIndex};return this.upgrade(r,{data:r});}`;
}

function getSwitchHandler(item: PathHandler) {
    return item.ws === -1 ? `return c${item.index}(r);` : getWSHandler(item.ws);
}

function checkMethods(list: PathHandler[]) {
    if (list.length === 1) {
        const item = list[0], { method } = item;
        return `if(method==='${method}')${getSwitchHandler(item)}break;`;
    }
    return `switch(method){${list.map(item => `case'${item.method}':${getSwitchHandler(item)}`)}}`;
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
            const currentHandler = pathHandlers[method];
            if (typeof currentHandler === 'number')
                ws = currentHandler as number;

            hs[path].push({ 
                method, index, ws,
            });
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
    for (const path in handlers)
        for (const item of handlers[path]) {
            fnSetLiteral += `c${item.index}=${getHandler(path, item.method)},`;
            if (item.ws !== -1) 
                fnWSLiteral += `w${item.index}=app.webSocketHandlers[${item.index}],`
        }

    // Paths
    const paths = Object.keys(routes);

    // Switch literal
    let fnSwitchLiteral = '';
    for (const path of paths)
        fnSwitchLiteral += `case'${path}':${checkMethods(handlers[path])}`;

    const preHandlerPrefix = isAsync(app.fnPre) ? 'await ' : '',
        switchStatement = (fnSwitchLiteral === '' ? '' : `switch(r.path){${fnSwitchLiteral}}`)
        + (routerExists ? handleRoute(returnStatement) : returnStatement);

    const exactHostExists = !!app.base;
    const exactHostVal = app.base?.length || 's', valPlusOne = exactHostExists ? exactHostVal + 1 : 's+1';

    // All variables are in here
    let declarationLiteral = `${fnSetLiteral}${app.fn404 ? `h=app.fn404,` : ''}${app.fn404 === false ? 'n={status:404},' : ''}${app.router ? `f=app.router.find.bind(app.router),` : ''}${app.fnPre ? 't=app.fnPre,' : ''}${app.injects ? 'i=app.injects,' : ''}${fnWSLiteral}`;
    if (declarationLiteral !== '')  
        declarationLiteral = 'const ' + declarationLiteral.slice(0, -1) + ';';

    const fnBody = `${declarationLiteral}return ${isAsync(app.fnPre) ? 'async ' : ''}function(r){const{url,method}=r${exactHostExists ? '' : ",s=url.indexOf('/',12)"};r.query=url.indexOf('?',${valPlusOne});if(r.query===-1)r.path=url.substring(${exactHostVal});else r.path=url.substring(${exactHostVal},r.query);${app.injects ? 'r.inject=i;' : ''}${app.fnPre 
    ? (app.fnPre.response
        ? `const b=${preHandlerPrefix}t(r);if(b!==undefined)return b;`
        : `if(${preHandlerPrefix}t(r)!==undefined)${returnStatement}`
    ) : ''
    }${switchStatement}}`;

    // Create function body
    return fnBody;
};

// Deez nuts
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
    const body = `return function(${argsList}){const i=w.data._.${name};if(i!==null)i(${argsList})}`;
    return Function(body)();
}
