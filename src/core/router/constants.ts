export const internalPrefix = '_',
    // Prefixes
    handlerPrefix = internalPrefix + 'c',
    rejectPrefix = internalPrefix + 'r',
    guardPrefix = internalPrefix + 'g',
    wsPrefix = internalPrefix + 'w',
    wrapperPrefixes = internalPrefix + 'd',
    // Special handlers and props
    invalidBodyHandler = internalPrefix + 'i',
    prevParamIndex = internalPrefix + 't',
    currentParamIndex = internalPrefix + 'e',
    nfHandler = internalPrefix + 'n',
    // Request related
    requestObjectName = 'r',
    storeObjectName = 's',
    // Request properties
    requestObjectPrefix = requestObjectName + '.',
    urlStartIndex = requestObjectPrefix + 'path',
    requestMethod = requestObjectPrefix + 'method',
    requestURL = requestObjectPrefix + 'url',
    requestQueryIndex = requestObjectPrefix + 'query',
    requestParams = requestObjectPrefix + 'params',
    requestParsedBody = requestObjectPrefix + 'data',
    // Predefined response options
    notFoundHeader = { status: 404 },
    badReqHeader = { status: 400 },
    serverErrorHeader = { status: 500 };
