import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { getFileIcon } from "../../Common/FileIcons.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import type { TabInfo } from "./EditorTabStripElement.ts";
import { EditorTabStripElement } from "./EditorTabStripElement.ts";

const tsIcon = getFileIcon("file.ts");
const jsIcon = getFileIcon("app.js");

function makeTabs(...names: string[]): TabInfo[] {
    return names.map((name) => {
        const fi = getFileIcon(name);
        return { label: name, icon: fi.icon, iconColor: fi.color, isModified: false };
    });
}

function renderStrip(strip: EditorTabStripElement, width: number): { backend: MockTerminalBackend; text: string } {
    const size = new Size(width, 1);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    strip.globalPosition = new Point(0, 0);
    strip.performLayout(BoxConstraints.tight(size));
    strip.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    const text = backend.getTextAt(new Point(0, 0), width);
    return { backend, text };
}

describe("EditorTabStripElement", () => {
    describe("basic rendering", () => {
        it("renders empty strip as filler", () => {
            const strip = new EditorTabStripElement();
            const { text } = renderStrip(strip, 20);
            expect(text.trim()).toBe("");
        });

        it("renders single tab with label", () => {
            const strip = new EditorTabStripElement();
            strip.setTabs(makeTabs("file.ts"));
            strip.activeIndex = 0;
            const { text } = renderStrip(strip, 40);
            expect(text).toContain("file.ts");
        });

        it("renders multiple tabs horizontally", () => {
            const strip = new EditorTabStripElement();
            strip.setTabs(makeTabs("file.ts", "app.js"));
            strip.activeIndex = 0;
            const { text } = renderStrip(strip, 60);
            expect(text).toContain("file.ts");
            expect(text).toContain("app.js");
        });

        it("filler fills remaining space", () => {
            const strip = new EditorTabStripElement();
            strip.setTabs(makeTabs("a.ts"));
            strip.activeIndex = 0;
            const { text } = renderStrip(strip, 40);
            // All characters should be filled (no nulls)
            expect(text.length).toBe(40);
        });
    });

    describe("active index", () => {
        it("applies active styles to the active tab", () => {
            const strip = new EditorTabStripElement();
            strip.activeFg = packRgb(255, 255, 255);
            strip.activeBg = packRgb(30, 30, 30);
            strip.inactiveFg = packRgb(100, 100, 100);
            strip.inactiveBg = packRgb(50, 50, 50);

            strip.setTabs(makeTabs("a.ts", "b.ts"));
            strip.activeIndex = 0;

            const items = strip.getItemElements();
            expect(items[0].style.fg).toBe(packRgb(255, 255, 255));
            expect(items[0].style.bg).toBe(packRgb(30, 30, 30));
            expect(items[1].style.fg).toBe(packRgb(100, 100, 100));
            expect(items[1].style.bg).toBe(packRgb(50, 50, 50));
        });

        it("changes active styles when activeIndex changes", () => {
            const strip = new EditorTabStripElement();
            strip.setTabs(makeTabs("a.ts", "b.ts"));
            strip.activeIndex = 0;

            strip.activeIndex = 1;

            const items = strip.getItemElements();
            expect(items[0].style.fg).toBe(strip.inactiveFg);
            expect(items[1].style.fg).toBe(strip.activeFg);
        });
    });

    describe("callbacks", () => {
        it("onTabActivate fires with correct index on tab click", () => {
            const strip = new EditorTabStripElement();
            const onActivate = vi.fn();
            strip.onTabActivate = onActivate;
            strip.setTabs(makeTabs("a.ts", "b.ts"));
            strip.activeIndex = 0;

            // Simulate onActivate callback from the second tab item
            const items = strip.getItemElements();
            items[1].onActivate?.();

            expect(onActivate).toHaveBeenCalledWith(1);
        });

        it("onTabClose fires with correct index on close click", () => {
            const strip = new EditorTabStripElement();
            const onClose = vi.fn();
            strip.onTabClose = onClose;
            strip.setTabs(makeTabs("a.ts", "b.ts"));
            strip.activeIndex = 0;

            const items = strip.getItemElements();
            items[0].onClose?.();

            expect(onClose).toHaveBeenCalledWith(0);
        });
    });

    describe("setTabs update", () => {
        it("updates existing tabs in place", () => {
            const strip = new EditorTabStripElement();
            strip.setTabs(makeTabs("a.ts", "b.ts"));

            const itemsBefore = strip.getItemElements();
            const firstItem = itemsBefore[0];

            strip.setTabs(makeTabs("c.ts", "d.ts"));

            const itemsAfter = strip.getItemElements();
            expect(itemsAfter[0]).toBe(firstItem);
            expect(itemsAfter[0].getLabel()).toBe("c.ts");
        });

        it("modified indicator updates through setTabs", () => {
            const strip = new EditorTabStripElement();
            const tabs = makeTabs("a.ts");
            strip.setTabs(tabs);

            const items = strip.getItemElements();
            expect(items[0].getModified()).toBe(false);

            tabs[0].isModified = true;
            strip.setTabs(tabs);
            expect(items[0].getModified()).toBe(true);
        });
    });

    describe("intrinsic size", () => {
        it("height is always 1", () => {
            const strip = new EditorTabStripElement();
            expect(strip.getMinIntrinsicHeight(100)).toBe(1);
            expect(strip.getMaxIntrinsicHeight(100)).toBe(1);
        });
    });
});
