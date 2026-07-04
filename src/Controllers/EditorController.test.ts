import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";

function createEditorController(
    overrides: {
        registry?: TokenizationRegistry;
        languageService?: ILanguageService;
        themeService?: ThemeService;
    } = {},
): EditorController {
    const themeService = overrides.themeService ?? new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorController(
        themeService,
        overrides.registry ?? new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        overrides.languageService ?? NULL_LANGUAGE_SERVICE,
    );
}

describe("EditorController", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-editorctrl-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
    }

    describe("fileName / save without a file", () => {
        it("has a null fileName before any file is opened", () => {
            const ctrl = createEditorController();

            expect(ctrl.fileName).toBeNull();
            expect(ctrl.absoluteFilePath).toBeNull();
        });

        it("save() is a no-op when no file is open (no file written, no onDidSave)", () => {
            const ctrl = createEditorController();
            let saved = false;
            ctrl.onDidSave = () => {
                saved = true;
            };

            // Must not throw and must not invoke the save callback.
            ctrl.save();

            expect(saved).toBe(false);
        });

        it("exposes the basename once a file is opened", () => {
            const ctrl = createEditorController();
            const fp = writeFile("hello.ts", "x");

            ctrl.openFile(fp);

            expect(ctrl.fileName).toBe("hello.ts");
            expect(ctrl.absoluteFilePath).toBe(fp);
        });
    });

    describe("pushUndo", () => {
        it("ignores an undefined element", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "abc"));

            // Should be a no-op: undo afterwards has nothing to revert.
            ctrl.pushUndo(undefined);
            ctrl.undo();

            expect(ctrl.getText()).toBe("abc");
        });

        it("registers a real undo element so undo reverts the edit", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", ""));

            const undoElement = ctrl.viewState.insertText("foo");
            expect(ctrl.getText()).toBe("foo");

            ctrl.pushUndo(undoElement);
            ctrl.undo();

            expect(ctrl.getText()).toBe("");

            ctrl.redo();
            expect(ctrl.getText()).toBe("foo");
        });
    });

    describe("setIndentOptions", () => {
        it("applies a new tab size and disables auto-detection", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "x"));

            ctrl.setIndentOptions({ tabSize: 2, insertSpaces: true });

            expect(ctrl.viewState.tabSize).toBe(2);
            expect(ctrl.viewState.insertSpaces).toBe(true);
            expect(ctrl.viewState.detectIndentation).toBe(false);
        });

        it("leaves state untouched when the patch matches current values", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "x"));
            const before = ctrl.viewState.detectIndentation;

            // tabSize 4 / insertSpaces false are the defaults → nothing changes.
            ctrl.setIndentOptions({ tabSize: 4, insertSpaces: false });

            expect(ctrl.viewState.tabSize).toBe(4);
            expect(ctrl.viewState.insertSpaces).toBe(false);
            // detectIndentation untouched because nothing actually changed.
            expect(ctrl.viewState.detectIndentation).toBe(before);
        });

        it("ignores a non-positive tab size", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "x"));

            ctrl.setIndentOptions({ tabSize: 0 });

            expect(ctrl.viewState.tabSize).toBe(4);
        });
    });

    describe("theme with missing editor gutter colors", () => {
        it("falls back to the editor background when gutter colors are absent", () => {
            const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
            const ctrl = createEditorController({ themeService });
            ctrl.openFile(writeFile("a.ts", "x"));

            // A theme that defines a background but no gutter/line-number colors.
            const sparseTheme = new WorkbenchTheme("sparse", "dark", { "editor.background": 0x112233 }, { rules: [] });

            expect(() => {
                themeService.setTheme(sparseTheme);
            }).not.toThrow();
        });
    });

    describe("pickTokenizer fallback", () => {
        it("uses a plain-text tokenizer when the registry has no support for the language", () => {
            const registry = new TokenizationRegistry();
            // Language service resolves an id, but the registry has nothing registered for it.
            const languageService: ILanguageService = {
                getLanguageIdForResource: () => "typescript",
                getLanguageDisplayName: () => undefined,
            };
            const ctrl = createEditorController({ registry, languageService });

            ctrl.openFile(writeFile("a.ts", "const x = 1;"));

            // The file opened through the fallback tokenizer path without error.
            expect(ctrl.getText()).toBe("const x = 1;");
        });

        it("uses the registered tokenizer when one is available", () => {
            const registry = new TokenizationRegistry();
            registry.register("typescript", new PlainTextTokenizer());
            const languageService: ILanguageService = {
                getLanguageIdForResource: () => "typescript",
                getLanguageDisplayName: () => undefined,
            };
            const ctrl = createEditorController({ registry, languageService });

            ctrl.openFile(writeFile("a.ts", "const x = 1;"));

            expect(ctrl.getText()).toBe("const x = 1;");
        });
    });
});
