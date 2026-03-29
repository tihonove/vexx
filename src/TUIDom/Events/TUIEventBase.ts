import type { TUIElement } from "../TUIElement.ts";

export const EventPhase = {
    NONE: 0,
    CAPTURING: 1,
    AT_TARGET: 2,
    BUBBLING: 3,
} as const;

export type EventPhase = (typeof EventPhase)[keyof typeof EventPhase];

export class TUIEventBase {
    public readonly type: string;
    public readonly bubbles: boolean;

    public target: TUIElement | null = null;
    public currentTarget: TUIElement | null = null;
    public eventPhase: EventPhase = EventPhase.NONE;

    private _propagationStopped = false;
    private _immediatePropagationStopped = false;
    private _defaultPrevented = false;

    public constructor(type: string, bubbles = true) {
        this.type = type;
        this.bubbles = bubbles;
    }

    public stopPropagation(): void {
        this._propagationStopped = true;
    }

    public get propagationStopped(): boolean {
        return this._propagationStopped;
    }

    public stopImmediatePropagation(): void {
        this._propagationStopped = true;
        this._immediatePropagationStopped = true;
    }

    public get immediatePropagationStopped(): boolean {
        return this._immediatePropagationStopped;
    }

    public preventDefault(): void {
        this._defaultPrevented = true;
    }

    public get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }
}
