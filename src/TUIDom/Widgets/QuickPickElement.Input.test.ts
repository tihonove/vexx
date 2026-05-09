import { describe, expect, it, vi } from "vitest";

import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";

import type { QuickPickItem } from "./QuickPickElement.ts";
import { QuickPickElement } from "./QuickPickElement.ts";

// ─── Test helpers ────────────────────────────────────────────────────────────

function createApp(picker: QuickPickElement, size: Size = new Size(40, 14)): TestApp {
    const app = TestApp.createWithContent(picker, size);
    picker.focus();
    return app;
}

function makeItems(count: number, prefix = "item-"): QuickPickItem[] {
    return Array.from({ length: count }, (_, i) => ({
        label: `${prefix}${i + 1}`,
    }));
}

// ─── Selection navigation ────────────────────────────────────────────────────

describe("QuickPickElement — ArrowDown / ArrowUp navigation", () => {
    it("ArrowDown moves selection from 0 to 1", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(5);
        const app = createApp(picker);

        expect(picker.selectedIndex).toBe(0);
        app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(1);
    });

    it("multiple ArrowDown presses advance selection", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(5);
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(3);
    });

    it("ArrowDown does not go past last item (no wrap)", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown"); // would be out of bounds if wrapping
        expect(picker.selectedIndex).toBe(2); // clamped at last
    });

    it("ArrowUp does not go below 0 (no wrap)", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        const app = createApp(picker);

        app.sendKey("ArrowUp"); // already at 0
        expect(picker.selectedIndex).toBe(0);
    });

    it("ArrowUp decrements selectedIndex", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(5);
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(2);
        app.sendKey("ArrowUp");
        expect(picker.selectedIndex).toBe(1);
    });

    it("navigation does nothing when items list is empty", () => {
        const picker = new QuickPickElement();
        picker.items = [];
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        app.sendKey("ArrowUp");
        expect(picker.selectedIndex).toBe(0);
    });
});

// ─── Scroll behaviour ────────────────────────────────────────────────────────

describe("QuickPickElement — scroll on navigation", () => {
    it("scrolls down when selection moves past the visible window", () => {
        const picker = new QuickPickElement();
        picker.maxVisibleItems = 3;
        picker.items = makeItems(10);
        const app = createApp(picker, new Size(40, 7)); // 4 + 3 = 7 rows high

        // Navigate down 4 times — item index 3 is outside the initial [0..2] window
        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(4);
        // scrollOffset should have moved so index 4 is visible
        // We can't read scrollOffset directly, but we can verify the rendered text
        app.render();
        const text = app.backend.screenToString();
        expect(text).toContain("item-5"); // index 4 = "item-5"
    });

    it("scrolls up when selection moves above the visible window", () => {
        const picker = new QuickPickElement();
        picker.maxVisibleItems = 3;
        picker.items = makeItems(10);
        const app = createApp(picker, new Size(40, 7));

        // Go down past window, then back to index 0
        for (let i = 0; i < 6; i++) app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(6);
        for (let i = 0; i < 6; i++) app.sendKey("ArrowUp");
        expect(picker.selectedIndex).toBe(0);
        // Scrolled back to top; item-1 (index 0) should be visible
        app.render();
        const text = app.backend.screenToString();
        expect(text).toContain("item-1");
    });
});

// ─── Enter / onAccept ────────────────────────────────────────────────────────

describe("QuickPickElement — Enter / onAccept", () => {
    it("Enter calls onAccept with the currently selected item and index", () => {
        const picker = new QuickPickElement();
        const items = makeItems(3);
        picker.items = items;
        const onAccept = vi.fn();
        picker.onAccept = onAccept;
        const app = createApp(picker);

        app.sendKey("Enter");

        expect(onAccept).toHaveBeenCalledOnce();
        expect(onAccept).toHaveBeenCalledWith(items[0], 0);
    });

    it("Enter after ArrowDown calls onAccept with the moved-to item", () => {
        const picker = new QuickPickElement();
        const items = makeItems(3);
        picker.items = items;
        const onAccept = vi.fn();
        picker.onAccept = onAccept;
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        app.sendKey("Enter");

        expect(onAccept).toHaveBeenCalledWith(items[1], 1);
    });

    it("Enter does not call onAccept when items list is empty", () => {
        const picker = new QuickPickElement();
        picker.items = [];
        const onAccept = vi.fn();
        picker.onAccept = onAccept;
        const app = createApp(picker);

        app.sendKey("Enter");

        expect(onAccept).not.toHaveBeenCalled();
    });
});

// ─── Escape / onCancel ───────────────────────────────────────────────────────

describe("QuickPickElement — Escape / onCancel", () => {
    it("Escape calls onCancel", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        const onCancel = vi.fn();
        picker.onCancel = onCancel;
        const app = createApp(picker);

        app.sendKey("Escape");

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it("Escape does not call onAccept", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        const onAccept = vi.fn();
        const onCancel = vi.fn();
        picker.onAccept = onAccept;
        picker.onCancel = onCancel;
        const app = createApp(picker);

        app.sendKey("Escape");

        expect(onAccept).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledOnce();
    });
});

// ─── Query / onQueryChange ────────────────────────────────────────────────────

describe("QuickPickElement — typing / onQueryChange", () => {
    it("typing characters calls onQueryChange with the new value", () => {
        const picker = new QuickPickElement();
        const onQueryChange = vi.fn();
        picker.onQueryChange = onQueryChange;
        const app = createApp(picker);

        app.sendKey("a");
        app.sendKey("p");
        app.sendKey("p");

        expect(onQueryChange).toHaveBeenCalledTimes(3);
        expect(onQueryChange).toHaveBeenLastCalledWith("app");
    });

    it("getQuery returns the current input value", () => {
        const picker = new QuickPickElement();
        const app = createApp(picker);

        app.sendKey("h");
        app.sendKey("i");

        expect(picker.getQuery()).toBe("hi");
    });

    it("setQuery updates the displayed text", () => {
        const picker = new QuickPickElement();
        createApp(picker);

        picker.setQuery("hello");
        expect(picker.getQuery()).toBe("hello");
    });

    it("Backspace removes the last typed character", () => {
        const picker = new QuickPickElement();
        const app = createApp(picker);

        app.sendKey("a");
        app.sendKey("b");
        app.sendKey("Backspace");

        expect(picker.getQuery()).toBe("a");
    });

    it("ArrowLeft / ArrowRight do not call onQueryChange", () => {
        const picker = new QuickPickElement();
        const onChange = vi.fn();
        picker.onQueryChange = onChange;
        const app = createApp(picker);

        app.sendKey("a");
        onChange.mockClear();

        app.sendKey("ArrowLeft");
        app.sendKey("ArrowRight");

        expect(onChange).not.toHaveBeenCalled();
    });

    it("typing does not change selectedIndex", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(5);
        const app = createApp(picker);

        app.sendKey("ArrowDown");
        expect(picker.selectedIndex).toBe(1);

        app.sendKey("a"); // typing should not reset selection
        expect(picker.selectedIndex).toBe(1);
    });
});

// ─── Focus delegation ─────────────────────────────────────────────────────────

describe("QuickPickElement — focus", () => {
    it("focus() delegates to the inner InputElement", () => {
        const picker = new QuickPickElement();
        const app = TestApp.createWithContent(picker, new Size(40, 3));

        picker.focus();

        expect(app.focusedElement).toBe(picker.inputElement);
    });

    it("inner InputElement accepts typed characters after focus", () => {
        const picker = new QuickPickElement();
        const app = TestApp.createWithContent(picker, new Size(40, 3));
        picker.focus();

        app.sendKey("x");
        expect(picker.getQuery()).toBe("x");
    });
});
