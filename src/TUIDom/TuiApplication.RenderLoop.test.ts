import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../Backend/MockTerminalBackend.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";
import type { MouseToken } from "../Input/RawTerminalToken.ts";

import { RenderContext, TUIElement } from "./TUIElement.ts";
import { TuiApplication } from "./TuiApplication.ts";
import { BodyElement } from "./Widgets/BodyElement.ts";

function moveMouse(x: number, y: number): MouseToken {
    return {
        kind: "mouse",
        button: "left",
        action: "move",
        x,
        y,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        raw: "",
    };
}

// A leaf that paints a character whose value depends on a mutable field, so we can
// observe whether a render actually happened after an event.
class StatefulLeaf extends TUIElement {
    public mark = "A";

    public override render(context: RenderContext): void {
        context.setCell(0, 0, { char: this.mark });
    }
}

class SingleChildBody extends BodyElement {
    public readonly leaf = new StatefulLeaf();

    public constructor() {
        super();
        this.setContent(this.leaf);
    }
}

describe("TuiApplication — render loop (renderFrame / handleMouse / handleResize)", () => {
    it("renders the root on run() so initial content reaches the backend", () => {
        const backend = new MockTerminalBackend(new Size(5, 2));
        const app = new TuiApplication(backend);
        const body = new SingleChildBody();
        app.root = body;
        app.run();

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("A");
    });

    it("re-renders after a mouse token, reflecting state changed by a handler", () => {
        const backend = new MockTerminalBackend(new Size(5, 2));
        const app = new TuiApplication(backend);
        const body = new SingleChildBody();
        // Mutate the painted mark when the mouse moves over the body.
        body.addEventListener("mousemove", () => {
            body.leaf.mark = "Z";
        });
        app.root = body;
        app.run();

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("A");

        backend.simulateMouse(moveMouse(1, 1));

        // handleMouse dispatched the event AND called renderFrame() → new mark drawn.
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("Z");
    });

    it("clears stale content on every frame (screen.clear in renderFrame)", () => {
        const backend = new MockTerminalBackend(new Size(5, 2));
        const app = new TuiApplication(backend);
        const body = new SingleChildBody();
        app.root = body;
        app.run();

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("A");

        // Change the painted char and drive a key event (synchronous renderFrame).
        body.leaf.mark = "B";
        backend.sendKey("x");

        // The previous "A" was cleared and replaced by "B" — not overdrawn/left behind.
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("B");
    });

    it("resizes the screen and re-renders content at the new dimensions", () => {
        const backend = new MockTerminalBackend(new Size(3, 1));
        const app = new TuiApplication(backend);
        const body = new SingleChildBody();
        app.root = body;
        app.run();

        const renderSpy = vi.spyOn(backend, "renderFrame");
        renderSpy.mockClear();

        backend.resize(new Size(8, 4));

        // handleResize replaced the screen, re-laid out, and rendered once.
        expect(app.screen.width).toBe(8);
        expect(app.screen.height).toBe(4);
        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(body.layoutSize.width).toBe(8);
        // Content still drawn after resize.
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("A");
    });
});
