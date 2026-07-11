import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { ICoreCompletionItem } from "../Editor/ICompletionSource.ts";
import type { ITextEdit } from "../Editor/ITextEdit.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

import { CompletionController } from "./CompletionController.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";

interface FakeEditor {
    applyExternalEdits: ReturnType<typeof vi.fn<(edits: ITextEdit[], label: string) => void>>;
    lineContent: string;
    character: number;
}

function makeEditor(
    lineContent: string,
    character: number,
    docText = lineContent,
): { editor: EditorController; fake: FakeEditor } {
    const fake: FakeEditor = {
        applyExternalEdits: vi.fn<(edits: ITextEdit[], label: string) => void>(),
        lineContent,
        character,
    };
    const editor = {
        viewState: {
            selections: [{ active: { line: 0, character } }],
            document: { getLineContent: () => lineContent },
        },
        getText: () => docText,
        absoluteFilePath: "/proj/.editorconfig",
        languageId: "editorconfig",
        getCaretAnchor: () => ({ screenX: 5, screenY: 5, preferBelow: true }),
        applyExternalEdits: fake.applyExternalEdits,
    } as unknown as EditorController;
    return { editor, fake };
}

function makeGroup(
    editor: EditorController,
    source: EditorGroupController["completionSource"],
    extraEditors: EditorController[] = [],
): EditorGroupController {
    const all = [editor, ...extraEditors];
    return {
        getActiveEditor: () => editor,
        completionSource: source,
        editorCount: all.length,
        getEditor: (i: number) => all[i] ?? null,
    } as unknown as EditorGroupController;
}

function setup(items: readonly ICoreCompletionItem[], lineContent = "ind", character = 3, docText = lineContent) {
    const { editor, fake } = makeEditor(lineContent, character, docText);
    const source = vi.fn(() => Promise.resolve(items));
    const group = makeGroup(editor, source);

    const controller = new CompletionController(group);
    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);
    const onExecuteCommand = vi.fn();
    controller.onExecuteCommand = onExecuteCommand;
    return { controller, body, testApp, fake, source, onExecuteCommand, editor };
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
        const { editor } = makeEditor("", 0);
        const controller = new CompletionController(makeGroup(editor, undefined));
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

    it("открывает попап и фильтрует по префиксу под курсором", async () => {
        const { controller, body } = setup(ITEMS);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
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
        // Enter принимает выбранный (indent_style).
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));

        expect(fake.applyExternalEdits).toHaveBeenCalledTimes(1);
        const [edits, label] = fake.applyExternalEdits.mock.calls[0];
        expect(label).toBe("Accept Completion");
        expect(edits).toHaveLength(1);
        expect(edits[0].text).toBe("indent_style");
        // Диапазон замены = префикс [0,0]–[0,3].
        expect(edits[0].range).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 3 } });

        // item.command исполняется через onExecuteCommand (в микротаске).
        await Promise.resolve();
        expect(onExecuteCommand).toHaveBeenCalledWith("ec._retrigger");
    });

    it("если префикс отфильтровал всё — показываем полный список", async () => {
        const { controller } = setup(ITEMS, "zzz", 3);
        await controller.trigger();
        expect(controller.view.items).toHaveLength(3);
    });

    it("word-based: без источника предлагает слова из документа", async () => {
        // Курсор после "ind" в документе со словами; провайдеров нет.
        const { editor } = makeEditor("ind", 3, "indent_style indent_size root ab");
        const controller = new CompletionController(makeGroup(editor, undefined));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
        // Префикс "ind" → только слова, содержащие "ind"; kind = Text (0).
        expect(controller.view.items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);
        expect(controller.view.items[0].kind).toBe(0);
    });

    it("word-based: собирает слова из всех открытых редакторов и дедупит с провайдерами", async () => {
        const { editor } = makeEditor("", 0, "alpha beta");
        const { editor: other } = makeEditor("", 0, "beta gamma indent_style");
        const source = vi.fn(() => Promise.resolve(ITEMS)); // indent_style, indent_size, root
        const controller = new CompletionController(makeGroup(editor, source, [other]));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();

        const labels = controller.view.items.map((i) => i.label);
        // Провайдерские (3) + слова alpha/beta/gamma; "indent_style" не дублируется.
        expect(labels).toEqual(["indent_style", "indent_size", "root", "alpha", "beta", "gamma"]);
    });

    it("нет активного редактора → no-op", async () => {
        const group = { getActiveEditor: () => null } as unknown as EditorGroupController;
        const controller = new CompletionController(group);
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("Escape закрывает попап", async () => {
        const { controller, body } = setup(ITEMS);
        await controller.trigger();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("каретка вне вьюпорта (anchor null) → попап не открывается", async () => {
        const { editor } = makeEditor("ind", 3, "ind");
        (editor as unknown as { getCaretAnchor: () => null }).getCaretAnchor = () => null;
        const controller = new CompletionController(
            makeGroup(
                editor,
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
        const { editor } = makeEditor("ind", 3, "ind");
        (editor as unknown as { absoluteFilePath: string | null }).absoluteFilePath = null;
        const source = vi.fn(() => Promise.resolve(ITEMS));
        const controller = new CompletionController(makeGroup(editor, source));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();
        expect(source).toHaveBeenCalledWith(expect.objectContaining({ fileName: "" }));
    });

    it("word-based пропускает несуществующий (null) редактор группы", async () => {
        const { editor } = makeEditor("", 0, "alpha beta");
        const group = {
            getActiveEditor: () => editor,
            completionSource: undefined,
            editorCount: 2, // но getEditor(1) === null
            getEditor: (i: number) => (i === 0 ? editor : null),
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
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));
        expect(fake.applyExternalEdits).not.toHaveBeenCalled();
    });

    it("accept элемента без command не дёргает onExecuteCommand", async () => {
        // Курсор на пустой строке → префикс пуст, показываем всё; выбираем "root" (без command).
        const { controller, fake, onExecuteCommand } = setup(ITEMS, "", 0, "");
        await controller.trigger();
        // root — третий; спустимся к нему.
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));
        expect(fake.applyExternalEdits).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        expect(onExecuteCommand).not.toHaveBeenCalled();
    });

    it("item.command без arguments исполняется c пустым списком аргументов", async () => {
        const items: ICoreCompletionItem[] = [{ label: "only", insertText: "only", command: { command: "c.noargs" } }];
        const { controller, onExecuteCommand } = setup(items, "", 0, "");
        await controller.trigger();
        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));
        await Promise.resolve();
        expect(onExecuteCommand).toHaveBeenCalledWith("c.noargs");
    });
});
