import { describe, expect, it, vi } from "vitest";

import type { ICoreCompletionItem } from "../Editor/ICompletionSource.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

import { CompletionController } from "./CompletionController.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";

interface FakeEditor {
    applyExternalEdits: ReturnType<typeof vi.fn>;
    lineContent: string;
    character: number;
}

function makeEditor(
    lineContent: string,
    character: number,
    docText = lineContent,
): { editor: EditorController; fake: FakeEditor } {
    const fake: FakeEditor = { applyExternalEdits: vi.fn(), lineContent, character };
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

function setup(
    items: readonly ICoreCompletionItem[],
    lineContent = "ind",
    character = 3,
    docText = lineContent,
) {
    const { editor, fake } = makeEditor(lineContent, character, docText);
    const source = vi.fn(async () => items);
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
    { label: "indent_style", insertText: "indent_style", kind: 9, command: { command: "ec._retrigger", arguments: [] } },
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
        const source = vi.fn(async () => ITEMS); // indent_style, indent_size, root
        const controller = new CompletionController(makeGroup(editor, source, [other]));
        const body = new BodyElement();
        TestApp.create(body, new Size(80, 24));
        controller.setHostView(body);
        await controller.trigger();

        const labels = controller.view.items.map((i) => i.label);
        // Провайдерские (3) + слова alpha/beta/gamma; "indent_style" не дублируется.
        expect(labels).toEqual(["indent_style", "indent_size", "root", "alpha", "beta", "gamma"]);
    });
});
