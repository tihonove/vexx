import { TerminalScreen } from "./Application/TerminalScreen.ts";
import { Offset, Point, Size } from "./Common/GeometryPromitives.ts";
import type { KeyPressEvent, TUIEvent } from "./TerminalBackend/KeyEvent.ts";

class RenderContext {
    public readonly canvas: TerminalScreen;

    public constructor(canvas: TerminalScreen) {
        this.canvas = canvas;
    }
}

export class TUIElement {
    public dirty = false;
    public size: Size = new Size(80, 24);
    public contentSize: Size = new Size(80, 24);
    private eventListeners: Partial<Record<string, ((event: KeyPressEvent) => void)[]>> = {};

    public emit(event: TUIEvent): void {
        const listeners = this.eventListeners[event.type] ?? [];
        for (const listener of listeners) {
            listener(event);
        }
    }

    public addEventListener(event: "keypress", handler: (event: KeyPressEvent) => void): void {
        this.eventListeners[event] ??= [];
        this.eventListeners[event].push(handler);
    }
}

export class BodyElement extends TUIElement {
    public title = "";

    public render(context: RenderContext) {
        for (let y = 0; y < this.title.length; y++) {
            context.canvas.setCell(new Point(0 + y, 0), { char: this.title[y] });
        }
    }
}
