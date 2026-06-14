import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { ROOT_RESOLVED_STYLE } from "../Styles/TUIStyle.ts";
import { RenderContext } from "../TUIElement.ts";

import { ACTIVE_MENU_BG, MENU_BAR_BG, MenuBarFillerElement, MenuBarItemElement } from "./MenuBarItemElement.tsx";

function render(element: MenuBarItemElement | MenuBarFillerElement, width?: number): MockTerminalBackend {
    const w = width ?? element.getMaxIntrinsicWidth(0);
    const h = element.getMaxIntrinsicHeight(w);
    const size = new Size(w, h);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    element.globalPosition = new Point(0, 0);
    element.performStyleResolution(ROOT_RESOLVED_STYLE);
    element.performLayout(BoxConstraints.tight(size));
    element.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

function clickEvent(): TUIMouseEvent {
    return new TUIMouseEvent("click", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 });
}

describe("MenuBarItemElement — metadata", () => {
    it("exposes label and mnemonic", () => {
        const item = new MenuBarItemElement("File", "F");
        expect(item.label).toBe("File");
        expect(item.mnemonic).toBe("F");
    });

    it("defaults active to false", () => {
        expect(new MenuBarItemElement("File").active).toBe(false);
    });
});

describe("MenuBarItemElement — active state", () => {
    it("toggles active and switches the background color", () => {
        const item = new MenuBarItemElement("File");
        expect(render(item).getBgAt(new Point(0, 0))).toBe(MENU_BAR_BG);

        item.active = true;
        expect(item.active).toBe(true);
        expect(render(item).getBgAt(new Point(0, 0))).toBe(ACTIVE_MENU_BG);
    });

    it("ignores a redundant set to the same value", () => {
        const item = new MenuBarItemElement("File");
        item.active = false; // unchanged — early return
        expect(item.active).toBe(false);
    });
});

describe("MenuBarItemElement — activation", () => {
    it("invokes onActivate on click", () => {
        const item = new MenuBarItemElement("File");
        const onActivate = vi.fn();
        item.onActivate = onActivate;

        item.dispatchEvent(clickEvent());

        expect(onActivate).toHaveBeenCalledOnce();
    });

    it("does nothing on click when default is prevented", () => {
        const item = new MenuBarItemElement("File");
        const onActivate = vi.fn();
        item.onActivate = onActivate;

        const event = clickEvent();
        event.preventDefault();
        item.dispatchEvent(event);

        expect(onActivate).not.toHaveBeenCalled();
    });

    it("does not throw on click without an onActivate handler", () => {
        const item = new MenuBarItemElement("File");
        expect(() => item.dispatchEvent(clickEvent())).not.toThrow();
    });
});

describe("MenuBarItemElement — rendering & mnemonic", () => {
    it("renders the label padded with spaces", () => {
        const backend = render(new MenuBarItemElement("File", "F"));
        expect(backend.getTextAt(new Point(0, 0), 6)).toBe(" File ");
    });

    it("renders when the mnemonic is not present in the label (no underline)", () => {
        const backend = render(new MenuBarItemElement("File", "z"));
        expect(backend.getTextAt(new Point(0, 0), 6)).toBe(" File ");
    });

    it("falls back to the first label character when no mnemonic is given", () => {
        const backend = render(new MenuBarItemElement("Edit"));
        expect(backend.getTextAt(new Point(0, 0), 6)).toBe(" Edit ");
    });

    it("handles an empty label", () => {
        expect(() => render(new MenuBarItemElement(""), 2)).not.toThrow();
    });
});

describe("MenuBarFillerElement", () => {
    it("has zero width and unit height intrinsics", () => {
        const filler = new MenuBarFillerElement();
        expect(filler.getMinIntrinsicWidth(0)).toBe(0);
        expect(filler.getMaxIntrinsicWidth(0)).toBe(0);
        expect(filler.getMinIntrinsicHeight(0)).toBe(1);
        expect(filler.getMaxIntrinsicHeight(0)).toBe(1);
    });

    it("fills its laid-out width with the menu-bar background", () => {
        const filler = new MenuBarFillerElement();
        const backend = render(filler, 4);
        expect(backend.getBgAt(new Point(0, 0))).toBe(MENU_BAR_BG);
        expect(backend.getBgAt(new Point(3, 0))).toBe(MENU_BAR_BG);
    });
});
