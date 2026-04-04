import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import type { MouseToken } from "../../Input/RawTerminalToken.ts";
import { TuiApplication } from "../TuiApplication.ts";
import { TUIElement } from "../TUIElement.ts";

import type { TUIMouseEvent } from "./TUIMouseEvent.ts";

// ─── Helpers ───

class ContainerElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this.children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this.children;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = super.performLayout(constraints);
        for (const child of this.children) {
            child.performLayout(BoxConstraints.tight(child.layoutSize));
        }
        return size;
    }
}

function makeToken(overrides: Partial<MouseToken> & { action: MouseToken["action"] }): MouseToken {
    return {
        kind: "mouse",
        button: "left",
        x: 1,
        y: 1,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        raw: "",
        ...overrides,
    };
}

// ─── Tests ───

describe("MouseEventDispatcher integration with TuiApplication", () => {
    it("delivers click event to element via simulateMouse", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
        const app = new TuiApplication(backend);

        const root = new ContainerElement();
        const child = new TUIElement();
        child.globalPosition = new Point(10, 5);
        child.performLayout(BoxConstraints.tight(new Size(20, 10)));
        root.addChild(child);

        app.root = root;
        app.run();

        const clicks: TUIMouseEvent[] = [];
        child.addEventListener("click", (e) => {
            clicks.push(e);
        });

        // 1-based coords: (16, 9) → 0-based (15, 8), inside child at (10,5)+(20,10)
        backend.simulateMouse(makeToken({ action: "press", x: 16, y: 9 }));
        backend.simulateMouse(makeToken({ action: "release", x: 16, y: 9 }));

        expect(clicks).toHaveLength(1);
        expect(clicks[0].screenX).toBe(15);
        expect(clicks[0].screenY).toBe(8);
    });

    it("delivers mouseenter when mouse moves onto element", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
        const app = new TuiApplication(backend);

        const root = new ContainerElement();
        const child = new TUIElement();
        child.globalPosition = new Point(10, 5);
        child.performLayout(BoxConstraints.tight(new Size(20, 10)));
        root.addChild(child);

        app.root = root;
        app.run();

        const enters: TUIMouseEvent[] = [];
        child.addEventListener("mouseenter", (e) => {
            enters.push(e);
        });

        backend.simulateMouse(makeToken({ action: "move", x: 16, y: 9 }));

        expect(enters).toHaveLength(1);
    });

    it("wheel event reaches element via backend", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
        const app = new TuiApplication(backend);

        const root = new TUIElement();
        app.root = root;
        app.run();

        const wheels: TUIMouseEvent[] = [];
        root.addEventListener("wheel", (e) => {
            wheels.push(e);
        });

        backend.simulateMouse(makeToken({ action: "scroll-down", x: 1, y: 1 }));

        expect(wheels).toHaveLength(1);
        expect(wheels[0].wheelDirection).toBe("down");
    });
});
