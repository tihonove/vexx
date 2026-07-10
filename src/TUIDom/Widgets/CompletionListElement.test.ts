import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
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

function renderToString(w: CompletionListElement): string {
    const size = new Size(w.getMaxIntrinsicWidth(0), w.getMaxIntrinsicHeight(0));
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    w.performLayout(BoxConstraints.tight(size));
    w.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend.screenToString();
}

// Editor-focus модель: виджет — чистый рендер + выбор. Клавиатуру он больше не
// обрабатывает (редактор сохраняет фокус); фильтр/выбор им управляет контроллер
// через setFilter / selectNext / selectPrev.
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

    it("setItems переприменяет текущий фильтр", () => {
        const w = makeWidget(ITEMS);
        w.setFilter("ind");
        w.setItems([...ITEMS, { label: "indented", kind: 9, data: 4 }]);
        expect(w.items.map((i) => i.label)).toEqual(["indent_style", "indent_size", "indented"]);
    });

    it("selectNext/selectPrev двигают выбор с clamp (без wrap)", () => {
        const w = makeWidget(ITEMS);
        w.selectPrev(); // уже на 0 — остаётся
        expect(w.selectedIndex).toBe(0);
        w.selectNext();
        w.selectNext();
        expect(w.getSelectedItem()?.label).toBe("insert_final_newline");
        w.selectNext(); // clamp на последнем
        expect(w.selectedIndex).toBe(2);
    });

    it("рендерится с рамкой (углы ┌┐└┘, как у остальных оверлеев)", () => {
        const w = makeWidget(ITEMS);
        const size = new Size(w.getMaxIntrinsicWidth(0), w.getMaxIntrinsicHeight(0));
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        w.performLayout(BoxConstraints.tight(size));
        w.render(new RenderContext(termScreen));
        termScreen.flush(backend);
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("┌");
        expect(backend.getTextAt(new Point(size.width - 1, 0), 1)).toBe("┐");
        expect(backend.getTextAt(new Point(0, size.height - 1), 1)).toBe("└");
        expect(backend.getTextAt(new Point(size.width - 1, size.height - 1), 1)).toBe("┘");
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

    it("скроллит окно при выборе вниз и обратно вверх", () => {
        const many = Array.from({ length: 15 }, (_, i) => ({ label: `item${i}`, data: i }));
        const w = makeWidget(many);
        w.maxVisibleItems = 5;
        for (let i = 0; i < 9; i++) w.selectNext(); // до index 9 — окно уехало вниз
        expect(w.selectedIndex).toBe(9);
        expect(renderToString(w)).toContain("item9");
        for (let i = 0; i < 9; i++) w.selectPrev(); // назад к 0 — окно вверх
        expect(w.selectedIndex).toBe(0);
        expect(renderToString(w)).toContain("item0");
    });

    it("пустой список: selectNext — no-op, getSelectedItem — null", () => {
        const w = makeWidget(ITEMS);
        w.setFilter("zzzz"); // ничего не матчит
        expect(w.items).toHaveLength(0);
        w.selectNext(); // moveSelection на пустом — return
        expect(w.selectedIndex).toBe(0);
        expect(w.getSelectedItem()).toBeNull();
    });
});
