export interface FindResult<T> extends Record<string, any> {
    '_': T
};

export interface ParamNode<T> {
    paramName: string
    store: T | null
    inert: Node<T> | null
}

export interface Node<T> {
    part: string
    store: T | null
    inert: Map<number, Node<T>> | null
    params: ParamNode<T> | null
    wildcardStore: T | null
}
