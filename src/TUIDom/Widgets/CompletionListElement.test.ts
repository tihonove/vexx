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

function renderToString(w: CompletionListElement): string {
    const size = new Size(w.getMaxIntrinsicWidth(0), w.getMaxIntrinsicHeight(0));
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    w.performLayout(BoxConstraints.tight(size));
    w.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend.screenToString();
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

    it("рендерится с рамкой (углы ╭╮╰╯, как у остальных оверлеев)", () => {
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
        expect(backend.getTextAt(new Point(size.width - 1, size.height - 1), 1)).toBe("╯");
        // Метка первого элемента присутствует на первом ряду.
        expect(backend.screenToString()).toContain("indent_style");
    });

    it("min и max intrinsic-размеры совпадают (self-sizing)", () => {
        const w = makeWidget(ITEMS);
        expect(w.getMinIntrinsicWidth(0)).toBe(w.getMaxIntrinsicWidth(0));
        expect(w.getMinIntrinsicHeight(0)).toBe(w.getMaxIntrinsicHeight(0));
    });

    it("рисует detail справа (выбранный и невыбранный ряд), длинный label усекается", () => {
        const w = makeWidget([
            { label: "x".repeat(60), detail: "Prop", kind: 9, data: 1 },
            { label: "size", detail: "Prop2", kind: 9, data: 2 },
        ]);
        const out = renderToString(w);
        expect(out).toContain("Prop"); // detail выбранного ряда
        expect(out).toContain("Prop2"); // detail невыбранного ряда (DETAIL_FG)
        expect(out).not.toContain("x".repeat(60)); // label усечён по ширине бокса
    });

    it("не рисует detail, если он не влезает", () => {
        const w = makeWidget([{ label: "ab", detail: "very-long-detail-text-here", kind: 9, data: 1 }]);
        w.preferredWidth = 16;
        const out = renderToString(w);
        expect(out).not.toContain("very-long-detail-text-here");
        expect(out).toContain("ab");
    });

    it("скроллит окно при навигации вниз и обратно вверх", () => {
        const many = Array.from({ length: 15 }, (_, i) => ({ label: `item${i}`, data: i }));
        const w = makeWidget(many);
        w.maxVisibleItems = 5;
        for (let i = 0; i < 9; i++) keydown(w, "ArrowDown"); // до index 9 — окно уехало вниз
        expect(w.selectedIndex).toBe(9);
        expect(renderToString(w)).toContain("item9");
        for (let i = 0; i < 9; i++) keydown(w, "ArrowUp"); // назад к 0 — окно вверх
        expect(w.selectedIndex).toBe(0);
        expect(renderToString(w)).toContain("item0");
    });

    it("пустой список: навигация/Enter — no-op, Backspace на пустом фильтре безопасен", () => {
        const w = makeWidget(ITEMS);
        w.setFilter("zzzz"); // ничего не матчит
        expect(w.items).toHaveLength(0);
        let accepted = false;
        w.onAccept = () => {
            accepted = true;
        };
        keydown(w, "ArrowDown"); // moveSelection на пустом — return
        keydown(w, "Enter"); // getSelectedItem null — без accept
        expect(accepted).toBe(false);
        w.setFilter("");
        keydown(w, "Backspace"); // фильтр пуст — no-op
        expect(w.filter).toBe("");
    });
});
