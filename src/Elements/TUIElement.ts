import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { Offset, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent, TUIEvent } from "../TerminalBackend/KeyEvent.ts";

export class RenderContext {
    readonly canvas: TerminalScreen;
    readonly offset: Offset;

    constructor(canvas: TerminalScreen, offset: Offset = new Offset(0, 0)) {
        this.canvas = canvas;
        this.offset = offset;
    }

    public withOffset(extra: Offset): RenderContext {
        return new RenderContext(this.canvas, new Offset(this.offset.dx + extra.dx, this.offset.dy + extra.dy));
    }
}

export class TUIElement {
    public dirty = false;
    public size: Size = new Size(80, 24);
    public contentSize: Size = new Size(80, 24);
    private eventListeners: { keypress: ((event: KeyPressEvent) => void)[] } = { keypress: [] };

    public emit(event: TUIEvent): void {
        const listeners = this.eventListeners[event.type];
        for (const listener of listeners) {
            listener(event);
        }
    }

    public addEventListener(event: "keypress", handler: (event: KeyPressEvent) => void): void {
        this.eventListeners[event].push(handler);
    }

    public removeEventListener(event: "keypress", handler: (event: KeyPressEvent) => void): void {
        const listeners = this.eventListeners[event];
        const index = listeners.indexOf(handler);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    public performLayout(): void {
        // Base implementation does nothing.
        // Container subclasses (VStackElement, etc.) override this.
    }

    public render(_context: RenderContext): void {
        // Base implementation does nothing.
        // Subclasses override to draw themselves.
    }
}
