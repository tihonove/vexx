import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { getFileIcon } from "../../Common/FileIcons.ts";
import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import { EditorTabItemElement } from "./EditorTabItemElement.ts";

const tsIcon = getFileIcon("file.ts");

function renderTab(tab: EditorTabItemElement, width?: number): { backend: MockTerminalBackend; text: string } {
    const intrinsicWidth = width ?? tab.getMaxIntrinsicWidth(1);
    const size = new Size(intrinsicWidth, 1);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    tab.globalPosition = new Point(0, 0);
    tab.performLayout(BoxConstraints.tight(size));
    tab.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    const text = backend.getTextAt(new Point(0, 0), intrinsicWidth);
    return { backend, text };
}

describe("EditorTabItemElement", () => {
    describe("intrinsic size", () => {
        it("calculates width with icon, label, and close button", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            // [1 pad][icon][space][file.ts][ ×][1 pad] = 1 + 1 + 1 + 7 + 2 + 1 = 13
            expect(tab.getMaxIntrinsicWidth(1)).toBe(13);
        });

        it("calculates width with modified indicator", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color, {
                modified: true,
            });
            // [1 pad][icon][space][file.ts][ ●][ ×][1 pad] = 1 + 1 + 1 + 7 + 2 + 2 + 1 = 15
            expect(tab.getMaxIntrinsicWidth(1)).toBe(15);
        });

        it("calculates width without icon", () => {
            const tab = new EditorTabItemElement("file.ts", "", packRgb(180, 180, 180));
            // [1 pad][file.ts][ ×][1 pad] = 1 + 7 + 2 + 1 = 11
            expect(tab.getMaxIntrinsicWidth(1)).toBe(11);
        });

        it("calculates width with custom padding", () => {
            const tab = new EditorTabItemElement("a.ts", tsIcon.icon, tsIcon.color, {
                paddingLeft: 2,
                paddingRight: 3,
            });
            // [2 pad][icon][space][a.ts][ ×][3 pad] = 2 + 1 + 1 + 4 + 2 + 3 = 13
            expect(tab.getMaxIntrinsicWidth(1)).toBe(13);
        });

        it("height is always 1", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            expect(tab.getMinIntrinsicHeight(100)).toBe(1);
            expect(tab.getMaxIntrinsicHeight(100)).toBe(1);
        });
    });

    describe("rendering", () => {
        it("renders tab with icon, label, and close button", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            const { text } = renderTab(tab);
            expect(text).toContain(tsIcon.icon);
            expect(text).toContain("file.ts");
            expect(text).toContain("\u00D7");
        });

        it("renders modified indicator when modified", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color, {
                modified: true,
            });
            const { text } = renderTab(tab);
            expect(text).toContain("\u25CF");
        });

        it("does not render modified indicator when not modified", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            const { text } = renderTab(tab);
            expect(text).not.toContain("\u25CF");
        });

        it("renders without icon when icon is empty", () => {
            const tab = new EditorTabItemElement("plain.txt", "", packRgb(180, 180, 180));
            const { text } = renderTab(tab);
            expect(text).toContain("plain.txt");
            expect(text).toContain("\u00D7");
        });

        it("renders padding as spaces", () => {
            const tab = new EditorTabItemElement("f.ts", tsIcon.icon, tsIcon.color, {
                paddingLeft: 2,
                paddingRight: 2,
            });
            const { text } = renderTab(tab);
            expect(text.startsWith("  ")).toBe(true);
            expect(text.endsWith("  ")).toBe(true);
        });
    });

    describe("setters", () => {
        it("setLabel updates label and re-renders", () => {
            const tab = new EditorTabItemElement("old.ts", tsIcon.icon, tsIcon.color);
            tab.setLabel("new.ts");
            expect(tab.getLabel()).toBe("new.ts");
        });

        it("setModified changes modified state", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            expect(tab.getModified()).toBe(false);
            tab.setModified(true);
            expect(tab.getModified()).toBe(true);
        });

        it("setModified with same value does not mark dirty", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            tab.globalPosition = new Point(0, 0);
            tab.performLayout(BoxConstraints.tight(new Size(20, 1)));
            expect(tab.isLayoutDirty).toBe(false);
            tab.setModified(false);
            expect(tab.isLayoutDirty).toBe(false);
        });
    });

    describe("click handling", () => {
        it("click on main area calls onActivate", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            const onActivate = vi.fn();
            tab.onActivate = onActivate;

            tab.globalPosition = new Point(0, 0);
            tab.performLayout(BoxConstraints.tight(new Size(tab.getMaxIntrinsicWidth(1), 1)));

            const event = new TUIMouseEvent("click", {
                button: "left",
                screenX: 3,
                screenY: 0,
                localX: 3,
                localY: 0,
            });
            tab.dispatchEvent(event);

            expect(onActivate).toHaveBeenCalledOnce();
        });

        it("click on close button calls onClose", () => {
            const tab = new EditorTabItemElement("file.ts", tsIcon.icon, tsIcon.color);
            const onClose = vi.fn();
            const onActivate = vi.fn();
            tab.onClose = onClose;
            tab.onActivate = onActivate;

            const w = tab.getMaxIntrinsicWidth(1);
            tab.globalPosition = new Point(0, 0);
            tab.performLayout(BoxConstraints.tight(new Size(w, 1)));

            // Close button is at position: width - paddingRight - 1
            const closeX = w - 1 - 1; // paddingRight=1, close char len=1
            const event = new TUIMouseEvent("click", {
                button: "left",
                screenX: closeX,
                screenY: 0,
                localX: closeX,
                localY: 0,
            });
            tab.dispatchEvent(event);

            expect(onClose).toHaveBeenCalledOnce();
            expect(onActivate).not.toHaveBeenCalled();
        });
    });
});
