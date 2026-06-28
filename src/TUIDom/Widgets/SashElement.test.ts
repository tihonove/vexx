import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import type { MouseToken } from "../../Input/RawTerminalToken.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { MouseEventDispatcher } from "../Events/MouseEventDispatcher.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { SashElement } from "./SashElement.ts";

class ContainerElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this.children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this.children;
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

/** A sash at screenX=30 inside an 80-wide root, with a captured onDrag log. */
function buildScene(): { root: ContainerElement; sash: SashElement; drags: number[] } {
    const root = new ContainerElement();
    root.setAsRoot();
    root.globalPosition = new Point(0, 0);
    root.performLayout(BoxConstraints.tight(new Size(80, 24)));

    const sash = new SashElement();
    sash.globalPosition = new Point(30, 0);
    sash.performLayout(BoxConstraints.tight(new Size(1, 24)));
    root.addChild(sash);

    const drags: number[] = [];
    sash.onDrag = (x) => drags.push(x);

    return { root, sash, drags };
}

describe("SashElement", () => {
    it("opts into pointer capture and stays unfocusable", () => {
        const sash = new SashElement();
        expect(sash.capturesPointer).toBe(true);
        expect(sash.tabIndex).toBe(-1);
    });

    it("renders nothing (invisible hit target)", () => {
        const size = new Size(10, 3);
        const sash = new SashElement();
        sash.globalPosition = new Point(0, 0);
        sash.performLayout(BoxConstraints.tight(new Size(1, 3)));

        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        sash.render(new RenderContext(termScreen, new Offset(0, 0), new Rect(new Point(0, 0), size)));
        termScreen.flush(backend);

        // Nothing drawn — the boundary stays owned by the surrounding panels.
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe(" ");
    });

    it("reports the absolute boundary column while dragging", () => {
        const { root, drags } = buildScene();
        const dispatcher = new MouseEventDispatcher();

        dispatcher.handleMouseToken(makeToken({ action: "press", x: 31, y: 1 }), root); // screenX 30
        dispatcher.handleMouseToken(makeToken({ action: "move", x: 41, y: 1 }), root); // screenX 40
        dispatcher.handleMouseToken(makeToken({ action: "move", x: 26, y: 1 }), root); // screenX 25
        dispatcher.handleMouseToken(makeToken({ action: "release", x: 26, y: 1 }), root);

        expect(drags).toEqual([40, 25]);
    });

    it("ignores moves that are not part of a left-button drag", () => {
        const { root, drags } = buildScene();
        const dispatcher = new MouseEventDispatcher();

        // A move with no prior mousedown must not trigger onDrag.
        dispatcher.handleMouseToken(makeToken({ action: "move", x: 41, y: 1 }), root);
        // A right-button press does not start a drag.
        dispatcher.handleMouseToken(makeToken({ action: "press", button: "right", x: 31, y: 1 }), root);
        dispatcher.handleMouseToken(makeToken({ action: "move", button: "right", x: 41, y: 1 }), root);

        expect(drags).toEqual([]);
    });

    it("stops reporting after the button is released", () => {
        const { root, sash, drags } = buildScene();
        const dispatcher = new MouseEventDispatcher();

        dispatcher.handleMouseToken(makeToken({ action: "press", x: 31, y: 1 }), root);
        dispatcher.handleMouseToken(makeToken({ action: "release", x: 31, y: 1 }), root);
        // Re-layout the sash to its (unchanged) spot, then move with no button held.
        sash.performLayout(BoxConstraints.tight(new Size(1, 24)));
        dispatcher.handleMouseToken(makeToken({ action: "move", x: 41, y: 1 }), root);

        expect(drags).toEqual([]);
    });
});
