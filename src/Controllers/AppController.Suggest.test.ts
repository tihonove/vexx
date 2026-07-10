import { afterEach, describe, expect, it } from "vitest";

import type { SuggestContext } from "./AppController.Suggest.TestUtils.ts";
import { createSuggestApp, disposeSuggestApp, type } from "./AppController.Suggest.TestUtils.ts";

// Editor-focus completion end-to-end через AppController: редактор сохраняет фокус,
// печать уходит в буфер, а навигационные клавиши перехватываются пока попап видим
// (`when: suggestWidgetVisible`). Источник — word-based (провайдеров в тест-профиле нет).
describe("AppController — suggest (editor-focus)", () => {
    let ctx: SuggestContext;

    afterEach(() => {
        disposeSuggestApp(ctx);
    });

    function popupVisible(): boolean {
        return ctx.controller.view.overlayLayer.hasVisibleItems();
    }

    function caret(): { line: number; character: number } {
        return ctx.activeEditor().viewState.selections[0].active;
    }

    it("Ctrl+Space открывает попап со словами из документа", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();
        expect(popupVisible()).toBe(true);
        // Печать реально ушла в буфер редактора.
        expect(ctx.activeEditor().viewState.document.getLineContent(0)).toBe("foo");
    });

    it("печать идёт в буфер (не во внутренний фильтр), попап живёт", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();

        ctx.testApp.sendKey("b"); // обычный ввод — должен попасть в буфер
        expect(ctx.activeEditor().viewState.document.getLineContent(0)).toBe("foob");
        // Попап пережил ввод и всё ещё показывает подходящие слова.
        expect(popupVisible()).toBe(true);
        expect(ctx.contextKeys.get("suggestWidgetVisible")).toBe(true);
    });

    it("↑/↓ перехватываются: навигируют попап, каретку не двигают", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();
        const before = caret();

        ctx.testApp.sendKey("ArrowDown");
        ctx.testApp.sendKey("ArrowUp"); // и вверх — оба направления перехвачены
        // Каретка осталась на месте — стрелки ушли в попап, а не в редактор.
        expect(caret()).toEqual(before);
        expect(popupVisible()).toBe(true);
    });

    it("Enter принимает выбранный элемент и не вставляет перевод строки", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();

        ctx.testApp.sendKey("Enter");
        // Выбран первый (foobar): префикс "foo" заменён на "foobar", без новой строки.
        expect(ctx.activeEditor().viewState.document.getLineContent(0)).toBe("foobar");
        expect(ctx.activeEditor().viewState.document.lineCount).toBe(2);
        expect(popupVisible()).toBe(false);
    });

    it("Tab тоже принимает выбранный элемент", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();

        ctx.testApp.sendKey("ArrowDown"); // выбрать foobaz
        ctx.testApp.sendKey("Tab");
        expect(ctx.activeEditor().viewState.document.getLineContent(0)).toBe("foobaz");
        expect(popupVisible()).toBe(false);
    });

    it("Escape закрывает попап, буфер не меняется", async () => {
        ctx = createSuggestApp("\nfoobar foobaz");
        type(ctx.testApp, "foo");
        await ctx.triggerSuggest();

        ctx.testApp.sendKey("Escape");
        expect(popupVisible()).toBe(false);
        expect(ctx.activeEditor().viewState.document.getLineContent(0)).toBe("foo");
    });

    it("вне попапа ↑/↓/Enter достаются редактору как обычно", () => {
        ctx = createSuggestApp("ab\ncd");
        // Попап не открыт — стрелка двигает каретку редактора.
        ctx.testApp.sendKey("ArrowDown");
        expect(caret().line).toBe(1);
        expect(ctx.contextKeys.get("suggestWidgetVisible")).toBe(false);
    });
});
