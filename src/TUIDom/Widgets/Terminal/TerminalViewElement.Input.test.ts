import { describe, expect, it } from "vitest";

import { BoxConstraints, Size } from "../../../Common/GeometryPromitives.ts";
import { FakeTerminalSurface } from "../../../TestUtils/FakeTerminalSurface.ts";
import { TUIKeyboardEvent } from "../../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../../Events/TUIMouseEvent.ts";
import type { TUIMouseEventType } from "../../Events/TUIMouseEvent.ts";
import { TUIPasteEvent } from "../../Events/TUIPasteEvent.ts";

import { TerminalViewElement } from "./TerminalViewElement.ts";

function makeElement(): { el: TerminalViewElement; surface: FakeTerminalSurface } {
    const surface = new FakeTerminalSurface();
    const el = new TerminalViewElement(surface);
    el.performLayout(BoxConstraints.tight(new Size(20, 10)));
    return { el, surface };
}

describe("TerminalViewElement — keyboard", () => {
    it.each([
        ["a", {}, "a"],
        ["Enter", {}, "\r"],
        ["c", { ctrlKey: true }, "\x03"], // Ctrl+C
    ])("encodes keydown %s to the exact PTY bytes", (key, mods, expected) => {
        const { el, surface } = makeElement();
        const event = new TUIKeyboardEvent("keydown", { key, ...mods });
        el.dispatchEvent(event);
        expect(surface.writes).toEqual([expected]);
        expect(event.defaultPrevented).toBe(true);
    });

    it("does not write or preventDefault for an untranslatable key", () => {
        const { el, surface } = makeElement();
        const event = new TUIKeyboardEvent("keydown", { key: "F1" });
        el.dispatchEvent(event);
        expect(surface.writes).toEqual([]);
        expect(event.defaultPrevented).toBe(false);
    });
});

describe("TerminalViewElement — paste", () => {
    it("writes the pasted text to the surface", () => {
        const { el, surface } = makeElement();
        const event = new TUIPasteEvent("hello world");
        el.dispatchEvent(event);
        expect(surface.writes).toEqual(["hello world"]);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe("TerminalViewElement — mouse", () => {
    function mouse(type: TUIMouseEventType, overrides: Partial<Parameters<typeof mouseInit>[0]> = {}): TUIMouseEvent {
        return new TUIMouseEvent(type, mouseInit(overrides));
    }

    function mouseInit(overrides: {
        button?: "left" | "middle" | "right" | "none";
        localX?: number;
        localY?: number;
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        wheelDirection?: "up" | "down" | "left" | "right";
    }): ConstructorParameters<typeof TUIMouseEvent>[1] {
        return {
            button: overrides.button ?? "left",
            screenX: overrides.localX ?? 0,
            screenY: overrides.localY ?? 0,
            localX: overrides.localX ?? 0,
            localY: overrides.localY ?? 0,
            ctrlKey: overrides.ctrlKey,
            altKey: overrides.altKey,
            shiftKey: overrides.shiftKey,
            wheelDirection: overrides.wheelDirection,
        };
    }

    it("forwards mousedown with local coords and semantic button/action", () => {
        const { el, surface } = makeElement();
        el.dispatchEvent(mouse("mousedown", { button: "left", localX: 4, localY: 2, ctrlKey: true }));
        expect(surface.mouseEvents).toEqual([
            { col: 4, row: 2, button: "left", action: "down", ctrl: true, alt: false, shift: false },
        ]);
    });

    it("forwards mouseup", () => {
        const { el, surface } = makeElement();
        el.dispatchEvent(mouse("mouseup", { button: "right", localX: 1, localY: 1 }));
        expect(surface.mouseEvents).toEqual([
            { col: 1, row: 1, button: "right", action: "up", ctrl: false, alt: false, shift: false },
        ]);
    });

    it("forwards mousemove", () => {
        const { el, surface } = makeElement();
        el.dispatchEvent(mouse("mousemove", { button: "none", localX: 7, localY: 3 }));
        expect(surface.mouseEvents).toEqual([
            { col: 7, row: 3, button: "none", action: "move", ctrl: false, alt: false, shift: false },
        ]);
    });

    it.each([
        ["up", "wheelUp"],
        ["down", "wheelDown"],
        ["left", "wheelLeft"],
        ["right", "wheelRight"],
    ] as const)("forwards wheel %s as button \"wheel\"", (direction, action) => {
        const { el, surface } = makeElement();
        el.dispatchEvent(mouse("wheel", { localX: 2, localY: 5, wheelDirection: direction }));
        expect(surface.mouseEvents).toEqual([
            { col: 2, row: 5, button: "wheel", action, ctrl: false, alt: false, shift: false },
        ]);
    });
});

describe("TerminalViewElement — layout", () => {
    it("resizes the surface to the allocated area", () => {
        const { surface } = makeElement(); // layout to 20x10 inside makeElement
        expect(surface.resizes).toEqual([{ cols: 20, rows: 10 }]);
    });
});
