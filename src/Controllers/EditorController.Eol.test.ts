import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EndOfLine } from "../Editor/EndOfLine.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
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

describe("EditorController EOL", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-editorctrl-eol-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
    }

    it("opens a CRLF file without marking it modified", () => {
        const filePath = writeFile("crlf.txt", "a\r\nb\r\nc");
        const ctrl = createEditorController();

        ctrl.openFile(filePath);

        expect(ctrl.eol).toBe(EndOfLine.CRLF);
        expect(ctrl.isModified).toBe(false);
    });

    it("round-trips a CRLF file byte-for-byte on save", () => {
        const original = "line1\r\nline2\r\nline3\r\n";
        const filePath = writeFile("crlf.txt", original);
        const ctrl = createEditorController();

        ctrl.openFile(filePath);
        ctrl.save();

        expect(fs.readFileSync(filePath, "utf-8")).toBe(original);
    });

    it("round-trips an LF file byte-for-byte on save", () => {
        const original = "line1\nline2\nline3\n";
        const filePath = writeFile("lf.txt", original);
        const ctrl = createEditorController();

        ctrl.openFile(filePath);
        ctrl.save();

        expect(fs.readFileSync(filePath, "utf-8")).toBe(original);
    });

    it("setEol marks the document modified and writes the new sequence on save", () => {
        const filePath = writeFile("lf.txt", "a\nb\nc");
        const ctrl = createEditorController();
        ctrl.openFile(filePath);
        expect(ctrl.isModified).toBe(false);

        ctrl.setEol(EndOfLine.CRLF);
        expect(ctrl.eol).toBe(EndOfLine.CRLF);
        expect(ctrl.isModified).toBe(true);

        ctrl.save();
        expect(fs.readFileSync(filePath, "utf-8")).toBe("a\r\nb\r\nc");
        expect(ctrl.isModified).toBe(false);
    });

    it("setEol to the same sequence is a no-op (not modified)", () => {
        const filePath = writeFile("lf.txt", "a\nb");
        const ctrl = createEditorController();
        ctrl.openFile(filePath);

        ctrl.setEol(EndOfLine.LF);

        expect(ctrl.isModified).toBe(false);
    });

    it("onDidChangeEol fires on setEol and on undo, surviving openFile re-creation", () => {
        const ctrl = createEditorController();
        let fired = 0;
        ctrl.onDidChangeEol(() => fired++);

        // Подписка сделана до openFile — документ внутри пересоздаётся,
        // но слушатель контроллера должен продолжать работать.
        ctrl.openFile(writeFile("lf.txt", "a\nb"));

        ctrl.setEol(EndOfLine.CRLF);
        expect(fired).toBe(1);

        ctrl.undo();
        expect(fired).toBe(2);
    });

    it("undo of an eol change restores the eol and clears the modified flag", () => {
        const filePath = writeFile("lf.txt", "a\nb");
        const ctrl = createEditorController();
        ctrl.openFile(filePath);

        ctrl.setEol(EndOfLine.CRLF);
        expect(ctrl.isModified).toBe(true);

        ctrl.undo();

        expect(ctrl.eol).toBe(EndOfLine.LF);
        expect(ctrl.isModified).toBe(false);
    });
});
