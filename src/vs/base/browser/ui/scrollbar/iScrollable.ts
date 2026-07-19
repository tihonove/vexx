export interface IContentSized {
    readonly contentHeight: number;
    readonly contentWidth: number;
}

export interface IScrollable extends IContentSized {
    readonly scrollTop: number;
    readonly scrollLeft: number;
}
