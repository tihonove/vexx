import type { TUIElement } from "../TUIElement.ts";

import { TUIFocusEvent } from "./TUIFocusEvent.ts";

export class FocusManager {
    public activeElement: TUIElement | null = null;
    private rootElement: TUIElement;

    public constructor(rootElement: TUIElement) {
        this.rootElement = rootElement;
    }

    public setFocus(element: TUIElement | null): void {
        if (element === this.activeElement) return;

        const oldElement = this.activeElement;

        if (oldElement) {
            const blurEvent = new TUIFocusEvent("blur", element);
            this.activeElement = null;
            oldElement.dispatchEvent(blurEvent);
        }

        this.activeElement = element;

        if (element) {
            const focusEvent = new TUIFocusEvent("focus", oldElement);
            element.dispatchEvent(focusEvent);
        }
    }

    public cycleFocus(direction: "forward" | "backward"): void {
        const focusable = this.rootElement.getDepthFirstFocusableOrder();
        if (focusable.length === 0) return;

        const currentIndex = this.activeElement ? focusable.indexOf(this.activeElement) : -1;

        let nextIndex: number;
        if (direction === "forward") {
            nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
        } else {
            nextIndex =
                currentIndex === -1 ? focusable.length - 1 : (currentIndex - 1 + focusable.length) % focusable.length;
        }

        this.setFocus(focusable[nextIndex]);
    }
}
