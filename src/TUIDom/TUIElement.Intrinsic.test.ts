import { describe, expect, it } from "vitest";

import { TextBlockElement } from "./Widgets/TextBlockElement.ts";
import { PopupMenuElement } from "./Widgets/PopupMenuElement.ts";
import { StatusBarElement } from "./Widgets/StatusBarElement.ts";
import { VStackElement } from "./Widgets/VStackElement.ts";
import { TUIElement } from "./TUIElement.ts";

describe("Intrinsic Size API", () => {
    describe("TUIElement base", () => {
        it("returns 0 for all intrinsic methods", () => {
            const el = new TUIElement();
            expect(el.getMinIntrinsicWidth(100)).toBe(0);
            expect(el.getMaxIntrinsicWidth(100)).toBe(0);
            expect(el.getMinIntrinsicHeight(100)).toBe(0);
            expect(el.getMaxIntrinsicHeight(100)).toBe(0);
        });
    });

    describe("TextBlockElement", () => {
        it("returns content dimensions", () => {
            const el = new TextBlockElement(5);
            expect(el.getMaxIntrinsicWidth(100)).toBe(el.contentWidth);
            expect(el.getMinIntrinsicWidth(100)).toBe(el.contentWidth);
            expect(el.getMaxIntrinsicHeight(100)).toBe(5);
            expect(el.getMinIntrinsicHeight(100)).toBe(5);
        });
    });

    describe("PopupMenuElement", () => {
        it("returns intrinsic size from entries", () => {
            const el = new PopupMenuElement([
                { label: "Open", shortcut: "Ctrl+O" },
                { label: "Save As", shortcut: "Ctrl+Shift+S" },
                { type: "separator" },
                { label: "Exit" },
            ]);
            const intrinsic = el.getIntrinsicSize();
            expect(el.getMaxIntrinsicWidth(100)).toBe(intrinsic.width);
            expect(el.getMinIntrinsicWidth(100)).toBe(intrinsic.width);
            expect(el.getMaxIntrinsicHeight(100)).toBe(intrinsic.height);
            expect(el.getMinIntrinsicHeight(100)).toBe(intrinsic.height);
        });
    });

    describe("StatusBarElement", () => {
        it("returns height 1 and text width", () => {
            const el = new StatusBarElement();
            el.setItems([{ text: "Ln 1" }, { text: "Col 1" }]);
            expect(el.getMaxIntrinsicHeight(100)).toBe(1);
            expect(el.getMinIntrinsicHeight(100)).toBe(1);
            expect(el.getMaxIntrinsicWidth(100)).toBe("Ln 1  Col 1".length);
            expect(el.getMinIntrinsicWidth(100)).toBe("Ln 1  Col 1".length);
        });

        it("returns 0 width with no items", () => {
            const el = new StatusBarElement();
            expect(el.getMaxIntrinsicWidth(100)).toBe(0);
        });
    });

    describe("VStackElement", () => {
        it("returns max width of fixed children", () => {
            const stack = new VStackElement();
            const child1 = new TextBlockElement(3);
            const child2 = new TextBlockElement(5);
            stack.addChild(child1, { width: 20, height: 3 });
            stack.addChild(child2, { width: 30, height: 5 });
            expect(stack.getMaxIntrinsicWidth(100)).toBe(30);
            expect(stack.getMinIntrinsicWidth(100)).toBe(30);
        });

        it("returns sum of children heights", () => {
            const stack = new VStackElement();
            stack.addChild(new TextBlockElement(3), { width: 20, height: 3 });
            stack.addChild(new TextBlockElement(5), { width: 20, height: 5 });
            expect(stack.getMaxIntrinsicHeight(100)).toBe(8);
            expect(stack.getMinIntrinsicHeight(100)).toBe(8);
        });

        it("delegates intrinsic width for fill children", () => {
            const stack = new VStackElement();
            const child = new TextBlockElement(3);
            stack.addChild(child, { width: "fill", height: 3 });
            expect(stack.getMaxIntrinsicWidth(100)).toBe(child.contentWidth);
        });
    });
});
