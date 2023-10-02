export const internalPrefix = '_',
    // Prefixes
    handlerPrefix = internalPrefix + 'c',
    rejectPrefix = internalPrefix + 'r',
    guardPrefix = internalPrefix + 'g',
    wsPrefix = internalPrefix + 'w',
    wrapperPrefix = internalPrefix + 'd',

    // Special handlers and props
    invalidBodyHandler = internalPrefix + 'i',
    prevParamIndex = internalPrefix + 't',
    currentParamIndex = internalPrefix + 'e',
    nfHandler = internalPrefix + 'n',
    appDetail = internalPrefix + 'a',
    debugServer = appDetail + '.' + 'server',

    // Request related
    requestObjectName = 'c',
    cachedMethod = 'method',

    // Request properties
    requestObjectPrefix = requestObjectName + '.',
    urlStartIndex = requestObjectPrefix + 'path',
    requestURL = requestObjectPrefix + 'url',
    requestQueryIndex = requestObjectPrefix + 'query',
    requestParams = requestObjectPrefix + 'params',
    requestParsedBody = requestObjectPrefix + 'data',

    // Predefined response options
    notFoundHeader = { status: 404 },
    jsonHeader = {
        headers: { 'Content-Type': 'application/json' }
    },
    badReqHeader = { status: 400 },
    serverErrorHeader = { status: 500 },

    // Predefined response function
    notFoundHandler = () => new Response(null, notFoundHeader),
    serverErrorHandler = () => new Response(null, serverErrorHeader),
    badRequestHandler = () => new Response(null, badReqHeader);
