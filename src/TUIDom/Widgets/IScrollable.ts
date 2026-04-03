import type { TUIElement } from "../TUIElement.ts";

export interface IScrollable {
    readonly contentHeight: number;
    readonly contentWidth: number;
    readonly scrollTop: number;
    readonly scrollLeft: number;
}

export function isScrollable(element: TUIElement): element is TUIElement & IScrollable {
    return "contentHeight" in element && "contentWidth" in element && "scrollTop" in element && "scrollLeft" in element;
}
