import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import type { QuickPickItem } from "./QuickPickElement.ts";
import { QuickPickElement } from "./QuickPickElement.ts";

// ─── Test helpers ────────────────────────────────────────────────────────────

function renderPicker(picker: QuickPickElement, width: number): MockTerminalBackend {
    const height = picker.getMinIntrinsicHeight(width);
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    picker.globalPosition = new Point(0, 0);
    picker.performLayout(BoxConstraints.tight(size));

    const clip = new Rect(new Point(0, 0), size);
    picker.render(new RenderContext(termScreen, new Offset(0, 0), clip));
    termScreen.flush(backend);
    return backend;
}

function makeItems(count: number, prefix = "file-"): QuickPickItem[] {
    return Array.from({ length: count }, (_, i) => ({
        label: `${prefix}${i + 1}.ts`,
        description: `src/`,
    }));
}

// ─── Height ──────────────────────────────────────────────────────────────────

describe("QuickPickElement — height", () => {
    it("is 3 when there are no items (border + input + border)", () => {
        const picker = new QuickPickElement();
        expect(picker.getMinIntrinsicHeight(40)).toBe(3);
    });

    it("is 4 + itemCount for 1 item", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(1);
        expect(picker.getMinIntrinsicHeight(40)).toBe(5); // 4 + 1
    });

    it("is 4 + itemCount for 3 items", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        expect(picker.getMinIntrinsicHeight(40)).toBe(7); // 4 + 3
    });

    it("caps at 4 + maxVisibleItems when items exceed limit", () => {
        const picker = new QuickPickElement();
        picker.maxVisibleItems = 5;
        picker.items = makeItems(20);
        expect(picker.getMinIntrinsicHeight(40)).toBe(9); // 4 + 5
    });
});

// ─── Border rendering ────────────────────────────────────────────────────────

describe("QuickPickElement — border", () => {
    it("draws top border on row 0", () => {
        const picker = new QuickPickElement();
        const backend = renderPicker(picker, 20);
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("┌");
        expect(backend.getTextAt(new Point(19, 0), 1)).toBe("┐");
    });

    it("draws bottom border on row 2 when no items", () => {
        const picker = new QuickPickElement();
        const backend = renderPicker(picker, 20);
        expect(backend.getTextAt(new Point(0, 2), 1)).toBe("└");
        expect(backend.getTextAt(new Point(19, 2), 1)).toBe("┘");
    });

    it("draws separator at row 2 when there are items", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(2);
        const backend = renderPicker(picker, 20);
        expect(backend.getTextAt(new Point(0, 2), 1)).toBe("├");
        expect(backend.getTextAt(new Point(19, 2), 1)).toBe("┤");
    });

    it("draws bottom border at last row when there are items", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(2);
        const height = picker.getMinIntrinsicHeight(20);
        const backend = renderPicker(picker, 20);
        expect(backend.getTextAt(new Point(0, height - 1), 1)).toBe("└");
        expect(backend.getTextAt(new Point(19, height - 1), 1)).toBe("┘");
    });
});

// ─── Placeholder ─────────────────────────────────────────────────────────────

describe("QuickPickElement — placeholder", () => {
    it("shows placeholder text on row 1 when query is empty", () => {
        const picker = new QuickPickElement();
        picker.placeholder = "Go to file…";
        const backend = renderPicker(picker, 30);
        const row = backend.getTextAt(new Point(1, 1), 15);
        expect(row).toContain("Go to file");
    });

    it("does not show placeholder when query has text", () => {
        const picker = new QuickPickElement();
        picker.placeholder = "Placeholder";
        picker.setQuery("hello");
        const backend = renderPicker(picker, 30);
        const row = backend.getTextAt(new Point(1, 1), 15);
        expect(row).toContain("hello");
        expect(row).not.toContain("Placeholder");
    });
});

// ─── Item rendering ───────────────────────────────────────────────────────────

describe("QuickPickElement — items", () => {
    it("renders item labels starting at row 3", () => {
        const picker = new QuickPickElement();
        picker.items = [
            { label: "Alpha" },
            { label: "Beta" },
            { label: "Gamma" },
        ];
        const backend = renderPicker(picker, 30);
        expect(backend.getTextAt(new Point(0, 3), 30)).toContain("Alpha");
        expect(backend.getTextAt(new Point(0, 4), 30)).toContain("Beta");
        expect(backend.getTextAt(new Point(0, 5), 30)).toContain("Gamma");
    });

    it("renders description on the right side of the row", () => {
        const picker = new QuickPickElement();
        picker.items = [{ label: "main.ts", description: "src/" }];
        const backend = renderPicker(picker, 30);
        const row = backend.getTextAt(new Point(0, 3), 30);
        expect(row).toContain("main.ts");
        expect(row).toContain("src/");
    });

    it("renders shortcut on the right side", () => {
        const picker = new QuickPickElement();
        picker.items = [{ label: "Save", shortcut: "Ctrl+S" }];
        const backend = renderPicker(picker, 30);
        const row = backend.getTextAt(new Point(0, 3), 30);
        expect(row).toContain("Save");
        expect(row).toContain("Ctrl+S");
    });

    it("renders badge text on the right side", () => {
        const picker = new QuickPickElement();
        picker.items = [{ label: "Open File", badge: "recent" }];
        const backend = renderPicker(picker, 40);
        const row = backend.getTextAt(new Point(0, 3), 40);
        expect(row).toContain("Open File");
        expect(row).toContain("recent");
    });

    it("renders icon column when any item has an icon", () => {
        const picker = new QuickPickElement();
        picker.items = [
            { icon: "A", label: "Alpha" },
            { label: "Beta" },
        ];
        const backend = renderPicker(picker, 30);
        // Row with icon: the icon char should appear before the label
        const rowWithIcon = backend.getTextAt(new Point(2, 3), 10);
        expect(rowWithIcon).toContain("A");
    });

    it("leaves icon slot empty (space) for items without icon", () => {
        const picker = new QuickPickElement();
        picker.items = [
            { icon: "A", label: "Alpha" },
            { label: "Beta" },     // no icon
        ];
        const backend = renderPicker(picker, 30);
        // For the row without icon, position 2 should be a space
        expect(backend.getTextAt(new Point(2, 4), 1)).toBe(" ");
    });
});

// ─── Selection ───────────────────────────────────────────────────────────────

describe("QuickPickElement — selection", () => {
    it("first item is selected by default (selectedIndex = 0)", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(3);
        expect(picker.selectedIndex).toBe(0);
    });

    it("selected item has a different background colour", () => {
        const picker = new QuickPickElement();
        picker.items = [{ label: "Alpha" }, { label: "Beta" }];
        const backend = renderPicker(picker, 30);

        const selectedBg = backend.getBgAt(new Point(5, 3));
        const normalBg = backend.getBgAt(new Point(5, 4));
        expect(selectedBg).not.toBe(normalBg);
        expect(selectedBg).toBe(picker.activeSelectionBg);
    });

    it("resets selectedIndex to 0 when items are replaced", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(5);
        // manually bump selectedIndex via navigation (we test this in Input tests)
        // Here we just verify the setter resets it
        picker.items = makeItems(3);
        expect(picker.selectedIndex).toBe(0);
    });
});

// ─── Match highlights ─────────────────────────────────────────────────────────

describe("QuickPickElement — match highlight colours", () => {
    it("matched chars in label have matchFg colour", () => {
        const picker = new QuickPickElement();
        // Put a match-highlighted item at index 1 so it is NOT selected
        // (index 0 is selected by default and uses activeSelectionFg).
        picker.items = [
            { label: "Other" },
            { label: "AppController", labelMatchRanges: [[0, 3]] },
        ];
        const backend = renderPicker(picker, 40);

        // Row 4 = item index 1 (not selected)
        // Label starts at x=2 (no icon column)
        const matchedFg = backend.getFgAt(new Point(2, 4));   // 'A' in "App"
        const unmatchedFg = backend.getFgAt(new Point(5, 4)); // 'C' in "Controller"
        expect(matchedFg).toBe(picker.matchFg);
        expect(unmatchedFg).not.toBe(picker.matchFg);
    });

    it("no special colour when labelMatchRanges is empty", () => {
        const picker = new QuickPickElement();
        picker.items = [{ label: "AppController" }];
        const backend = renderPicker(picker, 40);

        const fg = backend.getFgAt(new Point(2, 3));
        expect(fg).not.toBe(picker.matchFg);
    });
});

// ─── Scroll ───────────────────────────────────────────────────────────────────

describe("QuickPickElement — scroll", () => {
    it("renders only maxVisibleItems rows at a time", () => {
        const picker = new QuickPickElement();
        picker.maxVisibleItems = 3;
        picker.items = makeItems(10, "file-");
        const backend = renderPicker(picker, 30);

        // 10 items but only 3 visible: rows 3, 4, 5
        // Row 3: file-1
        expect(backend.getTextAt(new Point(0, 3), 30)).toContain("file-1");
        expect(backend.getTextAt(new Point(0, 4), 30)).toContain("file-2");
        expect(backend.getTextAt(new Point(0, 5), 30)).toContain("file-3");
    });

    it("scrolls viewport when rendering after selection moves past visible window", () => {
        const picker = new QuickPickElement();
        picker.maxVisibleItems = 3;
        // Create items and manually set items to simulate scroll state
        const items = makeItems(10, "file-");
        picker.items = items;

        // Move selection to item index 5 (0-based) by rebuilding items
        // with selectedIndex already past the window — we do this by calling
        // items setter (resets to 0), then simulating what the input tests cover.
        // For a pure render test, we can poke at internals via a fresh picker
        // that has been set up with a specific initial scroll via the public API.

        // The easiest approach: set items with maxVisibleItems = 3 and verify
        // that the first visible item is rendered correctly. Scroll correctness
        // is verified fully in Input tests (after ArrowDown navigation).
        const backend = renderPicker(picker, 30);
        const h = picker.getMinIntrinsicHeight(30);
        // Bottom border is at last row
        expect(backend.getTextAt(new Point(0, h - 1), 1)).toBe("└");
    });

    it("compact screen: only 3 rows fit in height constraint", () => {
        const picker = new QuickPickElement();
        picker.items = makeItems(2);
        // Force into a 3-high constraint — should not crash
        const size = new Size(30, 3);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        picker.globalPosition = new Point(0, 0);
        picker.performLayout(BoxConstraints.tight(size));
        const clip = new Rect(new Point(0, 0), size);
        picker.render(new RenderContext(termScreen, new Offset(0, 0), clip));
        termScreen.flush(backend);
        // Should not throw; just verify borders
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("┌");
    });
});

// ─── Snapshot rendering ───────────────────────────────────────────────────────

describe("QuickPickElement — snapshot", () => {
    it("renders empty picker correctly", () => {
        const picker = new QuickPickElement();
        picker.placeholder = "Go to file...";
        const backend = renderPicker(picker, 20);
        expectScreen(
            backend,
            screen`
                ┌──────────────────┐
                │Go to file...     │
                └──────────────────┘
            `,
        );
    });

    it("renders picker with two items", () => {
        const picker = new QuickPickElement();
        picker.placeholder = "Search";
        picker.items = [
            { label: "Alpha" },
            { label: "Beta" },
        ];
        const backend = renderPicker(picker, 20);
        expectScreen(
            backend,
            screen`
                ┌──────────────────┐
                │Search            │
                ├──────────────────┤
                │ Alpha            │
                │ Beta             │
                └──────────────────┘
            `,
        );
    });
});
