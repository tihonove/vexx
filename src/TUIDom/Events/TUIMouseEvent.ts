import { TUIEventBase } from "./TUIEventBase.ts";

export type TUIMouseEventType =
    | "mousedown"
    | "mouseup"
    | "mousemove"
    | "click"
    | "dblclick"
    | "mouseenter"
    | "mouseleave"
    | "wheel";

export type WheelDirection = "up" | "down" | "left" | "right";

export interface TUIMouseEventInit {
    button: "left" | "middle" | "right" | "none";
    screenX: number;
    screenY: number;
    localX: number;
    localY: number;
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    wheelDirection?: WheelDirection;
}

const NON_BUBBLING_TYPES: ReadonlySet<string> = new Set(["mouseenter", "mouseleave"]);

export class TUIMouseEvent extends TUIEventBase {
    public readonly button: "left" | "middle" | "right" | "none";
    public readonly screenX: number;
    public readonly screenY: number;
    public readonly localX: number;
    public readonly localY: number;
    public readonly shiftKey: boolean;
    public readonly altKey: boolean;
    public readonly ctrlKey: boolean;
    public readonly wheelDirection: WheelDirection | undefined;

    public constructor(type: TUIMouseEventType, init: TUIMouseEventInit) {
        super(type, !NON_BUBBLING_TYPES.has(type));
        this.button = init.button;
        this.screenX = init.screenX;
        this.screenY = init.screenY;
        this.localX = init.localX;
        this.localY = init.localY;
        this.shiftKey = init.shiftKey ?? false;
        this.altKey = init.altKey ?? false;
        this.ctrlKey = init.ctrlKey ?? false;
        this.wheelDirection = init.wheelDirection;
    }
}
