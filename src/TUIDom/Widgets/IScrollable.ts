import type { TUIElement } from "../TUIElement.ts";

export interface IContentSized {
    readonly contentHeight: number;
    readonly contentWidth: number;
}

export interface IScrollable extends IContentSized {
    readonly scrollTop: number;
    readonly scrollLeft: number;
}

export function isContentSized(element: TUIElement): element is TUIElement & IContentSized {
    return "contentHeight" in element && "contentWidth" in element;
}

export function isScrollable(element: TUIElement): element is TUIElement & IScrollable {
    return isContentSized(element) && "scrollTop" in element && "scrollLeft" in element;
}
