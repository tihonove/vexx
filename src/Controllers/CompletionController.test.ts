import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { ICoreCompletionItem } from "../Editor/ICompletionSource.ts";
import type { ITextEdit } from "../Editor/ITextEdit.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

import { CompletionController } from "./CompletionController.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";

interface FakeEditor {
    editor: EditorController;
    applyExternalEdits: ReturnType<typeof vi.fn<(edits: ITextEdit[], label: string) => void>>;
    /** Печать: обновляет строку/каретку и шлёт content+cursor (как typing/удаление). */
    type: (line: string, character: number) => void;
    /** Чистое движение каретки: шлёт только cursor (без content-маркера). */
    move: (lineNo: number, character: number) => void;
    /** Непустое выделение: anchor != active. */
    setSelection: (anchorChar: number, activeChar: number) => void;
    setAnchorNull: (value: boolean) => void;
}

function makeEditor(lineContent: string, character: number, docText = lineContent): FakeEditor {
    const state = { line: lineContent, lineNo: 0, anchorChar: character, activeChar: character };
    let anchorNull = false;
    const contentListeners: (() => void)[] = [];
    const cursorListeners: (() => void)[] = [];
    const applyExternalEdits = vi.fn<(edits: ITextEdit[], label: string) => void>();

    const editor = {
        get viewState() {
            return {
                selections: [
                    {
                        anchor: { line: state.lineNo, character: state.anchorChar },
                        active: { line: state.lineNo, character: state.activeChar },
                    },
                ],
                document: { getLineContent: (_line: number) => state.line },
            };
        },
        getText: () => docText,
        absoluteFilePath: "/proj/.editorconfig",
        languageId: "editorconfig",
        getCaretAnchor: () => (anchorNull ? null : { screenX: 5, screenY: 5, preferBelow: true }),
        applyExternalEdits,
        onDidChangeContent: (l: () => void) => {
            contentListeners.push(l);
            return { dispose: () => contentListeners.splice(contentListeners.indexOf(l), 1) };
        },
        onDidChangeCursorPosition: (l: () => void) => {
            cursorListeners.push(l);
            return { dispose: () => cursorListeners.splice(cursorListeners.indexOf(l), 1) };
        },
    } as unknown as EditorController;

    const fireContent = (): void => {
        for (const l of [...contentListeners]) l();
    };
    const fireCursor = (): void => {
        for (const l of [...cursorListeners]) l();
    };

    return {
        editor,
        applyExternalEdits,
        type: (line, ch) => {
            state.line = line;
            state.lineNo = 0;
            state.anchorChar = ch;
            state.activeChar = ch;
            fireContent();
            fireCursor();
        },
        move: (lineNo, ch) => {
            state.lineNo = lineNo;
            state.anchorChar = ch;
            state.activeChar = ch;
            fireCursor();
        },
        setSelection: (anchorChar, activeChar) => {
            state.anchorChar = anchorChar;
            state.activeChar = activeChar;
            fireCursor();
        },
        setAnchorNull: (value) => {
            anchorNull = value;
        },
    };
}

function makeGroup(
    editor: EditorController,
    source: EditorGroupController["completionSource"],
    extraEditors: EditorController[] = [],
): EditorGroupController {
    const all = [editor, ...extraEditors];
    return {
        getActiveEditor: () => editor,
        onActiveEditorChanged: () => ({ dispose: () => {} }),
        completionSource: source,
        editorCount: all.length,
        getEditor: (i: number) => all[i] ?? null,
    } as unknown as EditorGroupController;
}

function setup(items: readonly ICoreCompletionItem[], lineContent = "ind", character = 3, docText = lineContent) {
    const fake = makeEditor(lineContent, character, docText);
    const source = vi.fn(() => Promise.resolve(items));
    const group = makeGroup(fake.editor, source);

    const controller = new CompletionController(group);
    controller.autoSuggestDelayMs = 0; // детерминированный авто-suggest в тестах
    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);
    const onExecuteCommand = vi.fn();
    controller.onExecuteCommand = onExecuteCommand;
    return { controller, body, testApp, fake, source, onExecuteCommand, editor: fake.editor };
}

/** Даёт setTimeout(…, 0) авто-suggest'а отработать. */
function flushTimers(): Promise<void> {
    return new Promise((res) => setTimeout(res, 5));
}

const ITEMS: ICoreCompletionItem[] = [
    {
        label: "indent_style",
        insertText: "indent_style",
        kind: 9,
        detail: "EditorConfig",
        command: { command: "ec._retrigger", arguments: [] },
    },
    { label: "indent_size", insertText: "indent_size", kind: 9 },
    { label: "root", insertText: "root" },
];

describe("CompletionController", () => {
    it("нет источника и пустой документ → trigger no-op (попап скрыт)", async () => {
        const fake = makeEditor("", 0);
        const controller = new CompletionController(makeGroup(fake.editor, undefined));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("пустой ответ провайдеров → попап не открывается", async () => {
        const { controller, body } = setup([]);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("открывает попап и фильтрует по префиксу под курсором, не забирая фокус", async () => {
        const { controller, body } = setup(ITEMS);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
        expect(controller.isOpen()).toBe(true);
        expect(controller.view.isFocused).toBe(false); // редактор сохраняет фокус
        // Префикс "ind" отфильтровал "root".
        expect(controller.view.items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);
    });

    it("передаёт корректный запрос источнику", async () => {
        const { controller, source } = setup(ITEMS);
        await controller.trigger();
        expect(source).toHaveBeenCalledWith({
            fileName: "/proj/.editorconfig",
            languageId: "editorconfig",
            text: "ind",
            line: 0,
            character: 3,
        });
    });

    it("accept вставляет элемент, заменяя префикс, и исполняет item.command", async () => {
        const { controller, fake, onExecuteCommand } = setup(ITEMS);
        await controller.trigger();
        controller.acceptSelected(); // принимает выбранный (indent_style)

        expect(fake.applyExternalEdits).toHaveBeenCalledTimes(1);
        const [edits, label] = fake.applyExternalEdits.mock.calls[0];
        expect(label).toBe("Accept Completion");
        expect(edits).toHaveLength(1);
        expect(edits[0].text).toBe("indent_style");
        expect(edits[0].range).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 3 } });

        await Promise.resolve();
        expect(onExecuteCommand).toHaveBeenCalledWith("ec._retrigger");
    });

    it("если префикс отфильтровал всё — показываем полный список", async () => {
        const { controller } = setup(ITEMS, "zzz", 3);
        await controller.trigger();
        expect(controller.view.items).toHaveLength(3);
    });

    it("word-based: без источника предлагает слова из документа", async () => {
        const fake = makeEditor("ind", 3, "indent_style indent_size root ab");
        const controller = new CompletionController(makeGroup(fake.editor, undefined));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
        expect(controller.view.items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);
        expect(controller.view.items[0].kind).toBe(0);
    });

    it("word-based: собирает слова из всех открытых редакторов и дедупит с провайдерами", async () => {
        const fake = makeEditor("", 0, "alpha beta");
        const other = makeEditor("", 0, "beta gamma indent_style");
        const source = vi.fn(() => Promise.resolve(ITEMS));
        const controller = new CompletionController(makeGroup(fake.editor, source, [other.editor]));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();

        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toEqual(["indent_style", "indent_size", "root", "alpha", "beta", "gamma"]);
    });

    it("нет активного редактора → no-op", async () => {
        const group = {
            getActiveEditor: () => null,
            onActiveEditorChanged: () => ({ dispose: () => {} }),
        } as unknown as EditorGroupController;
        const controller = new CompletionController(group);
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("hide() закрывает попап", async () => {
        const { controller, body } = setup(ITEMS);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
        controller.hide();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
        expect(controller.isOpen()).toBe(false);
    });

    it("каретка вне вьюпорта (anchor null) → попап не открывается", async () => {
        const fake = makeEditor("ind", 3, "ind");
        fake.setAnchorNull(true);
        const controller = new CompletionController(
            makeGroup(
                fake.editor,
                vi.fn(() => Promise.resolve(ITEMS)),
            ),
        );
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("untitled (absoluteFilePath null) → fileName пустой в запросе", async () => {
        const fake = makeEditor("ind", 3, "ind");
        (fake.editor as unknown as { absoluteFilePath: string | null }).absoluteFilePath = null;
        const source = vi.fn(() => Promise.resolve(ITEMS));
        const controller = new CompletionController(makeGroup(fake.editor, source));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(source).toHaveBeenCalledWith(expect.objectContaining({ fileName: "" }));
    });

    it("word-based пропускает несуществующий (null) редактор группы", async () => {
        const fake = makeEditor("", 0, "alpha beta");
        const group = {
            getActiveEditor: () => fake.editor,
            onActiveEditorChanged: () => ({ dispose: () => {} }),
            completionSource: undefined,
            editorCount: 2, // но getEditor(1) === null
            getEditor: (i: number) => (i === 0 ? fake.editor : null),
        } as unknown as EditorGroupController;
        const controller = new CompletionController(group);
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(controller.view.items.map((i) => i.label)).toEqual(["alpha", "beta"]);
    });

    it("accept без активного редактора (после close) — no-op", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        controller.close(); // activeEditor = null, но список у view остаётся
        controller.acceptSelected();
        expect(fake.applyExternalEdits).not.toHaveBeenCalled();
    });

    it("accept элемента без command не дёргает onExecuteCommand", async () => {
        const { controller, fake, onExecuteCommand } = setup(ITEMS, "", 0, "");
        await controller.trigger();
        controller.selectNext();
        controller.selectNext(); // к "root" (без command)
        controller.acceptSelected();
        expect(fake.applyExternalEdits).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        expect(onExecuteCommand).not.toHaveBeenCalled();
    });

    it("item.command без arguments исполняется c пустым списком аргументов", async () => {
        const items: ICoreCompletionItem[] = [{ label: "only", insertText: "only", command: { command: "c.noargs" } }];
        const { controller, onExecuteCommand } = setup(items, "", 0, "");
        await controller.trigger();
        controller.acceptSelected();
        await Promise.resolve();
        expect(onExecuteCommand).toHaveBeenCalledWith("c.noargs");
    });

    // ─── Re-filter по мере набора (попап открыт) ───────────────────────────────

    it("набор сужает список и попап следует за кареткой", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        expect(controller.view.items).toHaveLength(2);
        fake.type("indent_st", 9); // префикс расширился — сужаем до одного
        expect(controller.view.items.map((i) => i.label)).toEqual(["indent_style"]);
        expect(controller.isOpen()).toBe(true);
    });

    it("набор без совпадений оставляет последний непустой список (не закрывает)", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        fake.type("indz", 4); // ничего не матчит
        expect(controller.view.items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);
        expect(controller.isOpen()).toBe(true);
    });

    it("смена строки закрывает попап", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        fake.move(1, 0); // ушли на другую строку
        expect(controller.isOpen()).toBe(false);
    });

    it("непустое выделение закрывает попап", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        fake.setSelection(1, 3); // anchor != active
        expect(controller.isOpen()).toBe(false);
    });

    it("каретка ушла из вьюпорта при наборе закрывает попап", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        fake.setAnchorNull(true);
        fake.type("indent", 6);
        expect(controller.isOpen()).toBe(false);
    });

    // ─── Авто-suggest (попап закрыт) ───────────────────────────────────────────

    it("набор word-символа авто-открывает попап", async () => {
        const { controller, fake, source } = setup(ITEMS); // старт: "ind", каретка 3
        expect(controller.isOpen()).toBe(false);
        fake.type("inde", 4); // вставлен один word-символ
        await flushTimers();
        expect(source).toHaveBeenCalled();
        expect(controller.isOpen()).toBe(true);
    });

    it("чистое движение каретки НЕ открывает попап", async () => {
        const { controller, fake, source } = setup(ITEMS);
        fake.move(0, 2); // без content-изменения
        await flushTimers();
        expect(source).not.toHaveBeenCalled();
        expect(controller.isOpen()).toBe(false);
    });

    it("принятие пункта не приводит к авто-переоткрытию", async () => {
        const { controller, fake } = setup(ITEMS);
        await controller.trigger();
        controller.acceptSelected(); // close() + suppress + applyExternalEdits (mock, без эмита)
        // Эмулируем правку accept как одиночную вставку у каретки — авто-suggest подавлен.
        fake.type("indent_style2", 13);
        await flushTimers();
        expect(controller.isOpen()).toBe(false);
    });

    it("onFocusChanged(false) закрывает открытый попап", async () => {
        const { controller } = setup(ITEMS);
        await controller.trigger();
        expect(controller.isOpen()).toBe(true);
        controller.onFocusChanged(false); // фокус ушёл с редактора
        expect(controller.isOpen()).toBe(false);
    });
});
