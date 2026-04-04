import { Point } from "../../Common/GeometryPromitives.ts";
import type { MouseToken } from "../../Input/RawTerminalToken.ts";
import type { TUIElement } from "../TUIElement.ts";

import { TUIMouseEvent } from "./TUIMouseEvent.ts";
import type { TUIMouseEventInit, TUIMouseEventType, WheelDirection } from "./TUIMouseEvent.ts";

const DOUBLE_CLICK_THRESHOLD = 300;

export class MouseEventDispatcher {
    private hoveredElement: TUIElement | null = null;
    private pressedElement: TUIElement | null = null;
    private pressedButton: "left" | "middle" | "right" | "none" | null = null;
    private lastClickTime = 0;
    private lastClickTarget: TUIElement | null = null;
    private lastPosition: Point | null = null;

    private now: () => number;

    public constructor(now?: () => number) {
        this.now = now ?? (() => Date.now());
    }

    public handleMouseToken(token: MouseToken, root: TUIElement): void {
        const screenX = token.x - 1;
        const screenY = token.y - 1;
        const point = new Point(screenX, screenY);
        const target = root.elementFromPoint(point);

        switch (token.action) {
            case "press":
                this.handlePress(target, token, screenX, screenY);
                break;
            case "release":
                this.handleRelease(target, token, screenX, screenY);
                break;
            case "move":
                this.handleMove(target, token, screenX, screenY);
                break;
            case "scroll-up":
            case "scroll-down":
            case "scroll-left":
            case "scroll-right":
                this.handleScroll(target, token, screenX, screenY);
                break;
        }

        this.lastPosition = point;
    }

    private handlePress(
        target: TUIElement | null,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        if (!target) return;
        this.pressedElement = target;
        this.pressedButton = token.button;
        this.dispatchOn(target, "mousedown", token, screenX, screenY);
    }

    private handleRelease(
        target: TUIElement | null,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        if (!target) return;
        this.dispatchOn(target, "mouseup", token, screenX, screenY);

        if (this.pressedElement === target && this.pressedButton === token.button) {
            this.dispatchOn(target, "click", token, screenX, screenY);

            const now = this.now();
            if (this.lastClickTarget === target && now - this.lastClickTime < DOUBLE_CLICK_THRESHOLD) {
                this.dispatchOn(target, "dblclick", token, screenX, screenY);
                this.lastClickTarget = null;
                this.lastClickTime = 0;
            } else {
                this.lastClickTarget = target;
                this.lastClickTime = now;
            }
        }

        this.pressedElement = null;
        this.pressedButton = null;
    }

    private handleMove(
        target: TUIElement | null,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        const oldHovered = this.hoveredElement;
        const newHovered = target;

        if (oldHovered !== newHovered) {
            this.dispatchEnterLeave(oldHovered, newHovered, token, screenX, screenY);
            this.hoveredElement = newHovered;
        }

        if (newHovered) {
            this.dispatchOn(newHovered, "mousemove", token, screenX, screenY);
        }
    }

    private handleScroll(
        target: TUIElement | null,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        if (!target) return;

        const directionMap: Record<string, WheelDirection> = {
            "scroll-up": "up",
            "scroll-down": "down",
            "scroll-left": "left",
            "scroll-right": "right",
        };

        const init = this.buildInit(target, token, screenX, screenY);
        init.wheelDirection = directionMap[token.action];
        const event = new TUIMouseEvent("wheel", init);
        target.dispatchEvent(event);
    }

    private dispatchEnterLeave(
        oldElement: TUIElement | null,
        newElement: TUIElement | null,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        const oldPath = oldElement ? this.getAncestorSet(oldElement) : new Set<TUIElement>();
        const newPath = newElement ? this.getAncestorSet(newElement) : new Set<TUIElement>();

        // mouseleave: from old element up to (but not including) common ancestors
        if (oldElement) {
            const leaveElements = this.getAncestorList(oldElement).filter((el) => !newPath.has(el));
            for (const el of leaveElements) {
                this.dispatchOn(el, "mouseleave", token, screenX, screenY);
            }
        }

        // mouseenter: from common ancestor down to new element
        if (newElement) {
            const enterElements = this.getAncestorList(newElement)
                .filter((el) => !oldPath.has(el))
                .reverse();
            for (const el of enterElements) {
                this.dispatchOn(el, "mouseenter", token, screenX, screenY);
            }
        }
    }

    private getAncestorList(element: TUIElement): TUIElement[] {
        // Returns path from element up to root (element first, root last)
        const path: TUIElement[] = [];
        let current: TUIElement | null = element;
        while (current !== null) {
            path.push(current);
            current = current.getParent();
        }
        return path;
    }

    private getAncestorSet(element: TUIElement): Set<TUIElement> {
        return new Set(this.getAncestorList(element));
    }

    private dispatchOn(
        target: TUIElement,
        type: TUIMouseEventType,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): void {
        const init = this.buildInit(target, token, screenX, screenY);
        const event = new TUIMouseEvent(type, init);
        target.dispatchEvent(event);
    }

    private buildInit(
        target: TUIElement,
        token: MouseToken,
        screenX: number,
        screenY: number,
    ): TUIMouseEventInit {
        return {
            button: token.button,
            screenX,
            screenY,
            localX: screenX - target.globalPosition.x,
            localY: screenY - target.globalPosition.y,
            shiftKey: token.shiftKey,
            altKey: token.altKey,
            ctrlKey: token.ctrlKey,
        };
    }
}
