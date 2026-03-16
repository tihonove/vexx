import type { TUIElement } from "./TUIElement.ts";

export interface IScrollable {
    contentHeight: number;
    scrollTop: number;
}

export function isScrollable(element: TUIElement): element is TUIElement & IScrollable {
    return "contentHeight" in element && "scrollTop" in element;
}
