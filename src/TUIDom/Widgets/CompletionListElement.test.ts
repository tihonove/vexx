import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import type { CompletionListItem } from "./CompletionListElement.ts";
import { CompletionListElement } from "./CompletionListElement.ts";

function makeWidget(items: CompletionListItem[]): CompletionListElement {
    const w = new CompletionListElement();
    w.setItems(items);
    return w;
}

const ITEMS: CompletionListItem[] = [
    { label: "indent_style", kind: 9, data: 1 },
    { label: "indent_size", kind: 9, data: 2 },
    { label: "insert_final_newline", kind: 4, data: 3 },
];

function keydown(w: CompletionListElement, key: string): void {
    w.dispatchEvent(new TUIKeyboardEvent("keydown", { key }));
}

describe("CompletionListElement", () => {
    it("показывает все элементы без фильтра", () => {
        const w = makeWidget(ITEMS);
        expect(w.items).toHaveLength(3);
        expect(w.getSelectedItem()?.label).toBe("indent_style");
    });

    it("фильтрует по подстроке (case-insensitive)", () => {
        const w = makeWidget(ITEMS);
        w.setFilter("IND");
        expect(w.items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);
        w.setFilter("final");
        expect(w.items.map((i) => i.label)).toEqual(["insert_final_newline"]);
    });

    it("↑/↓ двигают выбор с clamp (без wrap)", () => {
        const w = makeWidget(ITEMS);
        keydown(w, "ArrowUp"); // уже на 0 — остаётся
        expect(w.selectedIndex).toBe(0);
        keydown(w, "ArrowDown");
        keydown(w, "ArrowDown");
        expect(w.getSelectedItem()?.label).toBe("insert_final_newline");
        keydown(w, "ArrowDown"); // clamp на последнем
        expect(w.selectedIndex).toBe(2);
    });

    it("Enter → onAccept с выбранным элементом", () => {
        const w = makeWidget(ITEMS);
        keydown(w, "ArrowDown");
        let accepted: CompletionListItem | null = null;
        w.onAccept = (item) => {
            accepted = item;
        };
        keydown(w, "Enter");
        expect(accepted).not.toBeNull();
        expect(accepted!.data).toBe(2);
    });

    it("Tab тоже принимает", () => {
        const w = makeWidget(ITEMS);
        let accepted = false;
        w.onAccept = () => {
            accepted = true;
        };
        keydown(w, "Tab");
        expect(accepted).toBe(true);
    });

    it("Escape → onCancel", () => {
        const w = makeWidget(ITEMS);
        let cancelled = false;
        w.onCancel = () => {
            cancelled = true;
        };
        keydown(w, "Escape");
        expect(cancelled).toBe(true);
    });

    it("печатный символ сужает фильтр и шлёт onFilterChange", () => {
        const w = makeWidget(ITEMS);
        const filters: string[] = [];
        w.onFilterChange = (f) => filters.push(f);
        keydown(w, "f");
        expect(w.filter).toBe("f");
        expect(w.items.map((i) => i.label)).toEqual(["insert_final_newline"]);
        keydown(w, "Backspace");
        expect(w.filter).toBe("");
        expect(w.items).toHaveLength(3);
        expect(filters).toEqual(["f", ""]);
    });

    it("ctrl-комбинации не попадают в фильтр", () => {
        const w = makeWidget(ITEMS);
        w.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a", ctrlKey: true }));
        expect(w.filter).toBe("");
    });

    it("рендерится со скруглённой рамкой", () => {
        const w = makeWidget(ITEMS);
        const size = new Size(w.getMaxIntrinsicWidth(0), w.getMaxIntrinsicHeight(0));
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        w.performLayout(BoxConstraints.tight(size));
        w.render(new RenderContext(termScreen));
        termScreen.flush(backend);
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("╭");
        expect(backend.getTextAt(new Point(size.width - 1, 0), 1)).toBe("╮");
        expect(backend.getTextAt(new Point(0, size.height - 1), 1)).toBe("╰");
        // Метка первого элемента присутствует на первом ряду.
        expect(backend.screenToString()).toContain("indent_style");
    });
});
