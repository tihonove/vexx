import type { TUIElement } from "../TUIElement.ts";

export interface IScrollable {
    readonly contentHeight: number;
    readonly scrollTop: number;
}

export function isScrollable(element: TUIElement): element is TUIElement & IScrollable {
    return "contentHeight" in element && "scrollTop" in element;
}
