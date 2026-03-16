import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Offset, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent, TUIEvent } from "../TerminalBackend/KeyEvent.ts";

export class RenderContext {
    public readonly canvas: TerminalScreen;
    public readonly offset: Offset;

    public constructor(canvas: TerminalScreen, offset: Offset = new Offset(0, 0)) {
        this.canvas = canvas;
        this.offset = offset;
    }

    public withOffset(extra: Offset): RenderContext {
        return new RenderContext(this.canvas, new Offset(this.offset.dx + extra.dx, this.offset.dy + extra.dy));
    }
}

export type KeyboardEventType = "keypress" | "keydown" | "keyup";

export class TUIElement {
    public dirty = false;
    public size: Size = new Size(80, 24);
    public layoutStyle: unknown = undefined;
    public layoutState: unknown = undefined;
    private eventListeners: Record<KeyboardEventType, ((event: KeyPressEvent) => void)[]> = {
        keypress: [],
        keydown: [],
        keyup: [],
    };

    public emit(event: TUIEvent): void {
        const listeners = this.eventListeners[event.type];
        for (const listener of listeners) {
            listener(event);
        }
    }

    public addEventListener(event: KeyboardEventType, handler: (event: KeyPressEvent) => void): void {
        this.eventListeners[event].push(handler);
    }

    public removeEventListener(event: KeyboardEventType, handler: (event: KeyPressEvent) => void): void {
        const listeners = this.eventListeners[event];
        const index = listeners.indexOf(handler);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    public performLayout(constraints: BoxConstraints): void {
        this.size = constraints.constrain(this.size);
    }

    public render(_context: RenderContext): void {
        // Base implementation does nothing.
        // Subclasses override to draw themselves.
    }
}
