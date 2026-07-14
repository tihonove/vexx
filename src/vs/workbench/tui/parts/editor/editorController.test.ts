import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../../../../base/common/geometry.ts";
import { createCursorSelection } from "../../../../editor/common/core/selection.ts";
import { PlainTextTokenizer } from "../../../../editor/common/languages/plainTextTokenizer.ts";
import type { ILanguageService } from "../../../../editor/common/languages/language.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { packRgb } from "../../../../base/common/color.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";

import { EditorController } from "./editorController.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

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
        new UndoRedoService(),
    );
}

describe("EditorController", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-editorctrl-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    function writeFile(name: string, content: string): string {
        return ws.writeFile(name, content);
    }

    describe("fileName / save without a file", () => {
        it("has a null fileName before any file is opened", () => {
            const ctrl = createEditorController();

            expect(ctrl.fileName).toBeNull();
            expect(ctrl.absoluteFilePath).toBeNull();
        });

        it("getCaretAnchor: anchor у видимой каретки, null когда каретка вне вьюпорта", () => {
            const ctrl = createEditorController();
            expect(ctrl.getCaretAnchor()).toMatchObject({ preferBelow: true });

            // Уводим каретку за пределы вьюпорта скроллом.
            ctrl.viewState.scrollTop = 1000;
            expect(ctrl.getCaretAnchor()).toBeNull();
        });

        it("save() is a no-op when no file is open (no file written, no onDidSave)", async () => {
            const ctrl = createEditorController();
            let saved = false;
            ctrl.onDidSave = () => {
                saved = true;
            };

            // Must not throw and must not invoke the save callback.
            await ctrl.save();

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

    describe("saveAs", () => {
        it("writes content to the new path and re-points the editor", async () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.txt", "content"));
            let saved = 0;
            ctrl.onDidSave = () => {
                saved++;
            };

            const newPath = ws.path("b.md");
            await ctrl.saveAs(newPath);

            expect(fs.readFileSync(newPath, "utf-8")).toBe("content");
            expect(ctrl.absoluteFilePath).toBe(newPath);
            expect(ctrl.fileName).toBe("b.md");
            expect(ctrl.isModified).toBe(false);
            expect(saved).toBe(1);
        });

        it("persists in-memory edits and clears the dirty flag", async () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.txt", ""));
            ctrl.viewState.insertText("edited");
            expect(ctrl.isModified).toBe(true);

            const newPath = ws.path("b.txt");
            await ctrl.saveAs(newPath);

            expect(fs.readFileSync(newPath, "utf-8")).toBe("edited");
            expect(ctrl.isModified).toBe(false);
        });

        it("re-picks the tokenizer for the new extension", async () => {
            const seen: string[] = [];
            const languageService: ILanguageService = {
                getLanguageIdForResource: (p) => {
                    seen.push(p);
                    return "typescript";
                },
                getLanguageDisplayName: () => undefined,
            };
            const ctrl = createEditorController({ languageService });
            ctrl.openFile(writeFile("a.txt", "x"));

            const newPath = ws.path("b.ts");
            await ctrl.saveAs(newPath);

            expect(seen).toContain(newPath);
        });

        it("works for an editor that never had a file (untitled)", async () => {
            const ctrl = createEditorController();
            ctrl.viewState.insertText("hi");

            const newPath = ws.path("new.txt");
            await ctrl.saveAs(newPath);

            expect(fs.readFileSync(newPath, "utf-8")).toBe("hi");
            expect(ctrl.absoluteFilePath).toBe(newPath);
            expect(ctrl.isModified).toBe(false);
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

    describe("setCursorSurroundingLines", () => {
        it("normalizes fractional/negative values to a non-negative integer", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "x"));

            ctrl.setCursorSurroundingLines(3.9);
            expect(ctrl.viewState.cursorSurroundingLines).toBe(3);

            ctrl.setCursorSurroundingLines(-5);
            expect(ctrl.viewState.cursorSurroundingLines).toBe(0);
        });

        it("is a no-op when the normalized value matches the current one", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.ts", "x"));

            ctrl.setCursorSurroundingLines(2);
            expect(ctrl.viewState.cursorSurroundingLines).toBe(2);

            // 2.4 normalizes back to 2 → early return, value unchanged.
            ctrl.setCursorSurroundingLines(2.4);
            expect(ctrl.viewState.cursorSurroundingLines).toBe(2);
        });
    });

    describe("theme with missing editor gutter colors", () => {
        it("falls back to the editor background when gutter colors are absent", () => {
            const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
            const ctrl = createEditorController({ themeService });
            ctrl.openFile(writeFile("a.ts", "x"));

            // A theme that overrides the background but defines no gutter color.
            // editorGutter.background has no registry default (genuinely optional),
            // so the gutter falls back to the editor background without throwing.
            const sparseTheme = WorkbenchTheme.fromThemeFile({
                name: "sparse",
                type: "dark",
                colors: { "editor.background": "#112233" },
            });

            expect(() => {
                themeService.setTheme(sparseTheme);
            }).not.toThrow();
        });
    });

    describe("occurrence highlight", () => {
        // Occurrence-highlight background from darkPlus (#474747).
        const OCCURRENCE_BG = packRgb(71, 71, 71);

        function renderRow0Bg(ctrl: EditorController, col: number): number {
            const app = TestApp.createWithContent(ctrl.view, new Size(20, 3));
            app.render();
            return app.backend.getBgAt(new Point(col, 0));
        }

        it("highlights the word under the cursor using the theme's wordHighlight color", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.txt", "foo foo"));
            ctrl.viewState.selections = [createCursorSelection(0, 0)];

            // gutterWidth = 6 (2 pad + 1 digit + 3 fold margin); content col 0 is the first "foo".
            expect(renderRow0Bg(ctrl, 6)).toBe(OCCURRENCE_BG);
        });

        it("stops highlighting once disabled via setOccurrenceHighlightEnabled", () => {
            const ctrl = createEditorController();
            ctrl.openFile(writeFile("a.txt", "foo foo"));
            ctrl.viewState.selections = [createCursorSelection(0, 0)];

            ctrl.setOccurrenceHighlightEnabled(false);
            // Toggling to the same value again is a no-op (covers the early return).
            ctrl.setOccurrenceHighlightEnabled(false);

            expect(renderRow0Bg(ctrl, 4)).not.toBe(OCCURRENCE_BG);
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
