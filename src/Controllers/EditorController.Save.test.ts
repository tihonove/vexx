import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Uri } from "../Common/Uri.ts";

import { EndOfLine } from "../Editor/EndOfLine.ts";
import type { ISaveEdit } from "../Editor/ISaveParticipant.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

function createEditorController(): EditorController {
    return new EditorController(
        new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        new UndoRedoService(),
    );
}

describe("EditorController — save participant", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-editorctrl-save-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    function writeFile(name: string, content: string): string {
        return ws.writeFile(name, content);
    }

    it("применяет текстовые правки участника перед записью", async () => {
        const controller = createEditorController();
        const fp = writeFile("a.txt", "abc   \n");
        controller.openFile(Uri.file(fp));
        // Удаляем хвостовые пробелы: правка стирает диапазон 3..6 строки 0.
        controller.saveParticipant = () =>
            Promise.resolve<ISaveEdit[]>([
                { kind: "text", range: { start: { line: 0, character: 3 }, end: { line: 0, character: 6 } }, text: "" },
            ]);

        await controller.save();

        expect(fs.readFileSync(fp, "utf-8")).toBe("abc\n");
        controller.dispose();
    });

    it("клампит диапазоны правок к границам документа", async () => {
        const controller = createEditorController();
        const fp = writeFile("clamp.txt", "ab\ncd");
        controller.openFile(Uri.file(fp));
        controller.saveParticipant = () =>
            Promise.resolve<ISaveEdit[]>([
                // line/char за верхней границей → (последняя строка, её длина)
                {
                    kind: "text",
                    range: { start: { line: 99, character: 99 }, end: { line: 99, character: 99 } },
                    text: "A",
                },
                // отрицательные line/char → (0, 0)
                {
                    kind: "text",
                    range: { start: { line: -1, character: -1 }, end: { line: -1, character: -1 } },
                    text: "B",
                },
                // в границах → без изменений позиции
                {
                    kind: "text",
                    range: { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
                    text: "C",
                },
            ]);

        await controller.save();

        expect(fs.readFileSync(fp, "utf-8")).toBe("BaCb\ncdA");
        controller.dispose();
    });

    it("смена EOL из участника (kind: eol) пишет CRLF", async () => {
        const controller = createEditorController();
        const fp = writeFile("eol.txt", "a\nb\n");
        controller.openFile(Uri.file(fp));
        controller.saveParticipant = () => Promise.resolve<ISaveEdit[]>([{ kind: "eol", eol: EndOfLine.CRLF }]);

        await controller.save();

        expect(fs.readFileSync(fp, "utf-8")).toBe("a\r\nb\r\n");
        controller.dispose();
    });

    it("saveAs тоже прогоняет участника", async () => {
        const controller = createEditorController();
        const fp = writeFile("src.txt", "hi   \n");
        controller.openFile(Uri.file(fp));
        controller.saveParticipant = () =>
            Promise.resolve<ISaveEdit[]>([
                { kind: "text", range: { start: { line: 0, character: 2 }, end: { line: 0, character: 5 } }, text: "" },
            ]);

        const dst = ws.path("dst.txt");
        await controller.saveAs(dst);

        expect(fs.readFileSync(dst, "utf-8")).toBe("hi\n");
        controller.dispose();
    });

    it("без участника save остаётся синхронной записью", async () => {
        const controller = createEditorController();
        const fp = writeFile("plain.txt", "keep   \n");
        controller.openFile(Uri.file(fp));

        await controller.save();

        expect(fs.readFileSync(fp, "utf-8")).toBe("keep   \n");
        controller.dispose();
    });
});
