import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorGroupController } from "./EditorGroupController.ts";

function createEditorGroupController(
    overrides: {
        registry?: TokenizationRegistry;
        languageService?: ILanguageService;
        configurationService?: IConfigurationService;
        themeService?: ThemeService;
    } = {},
): EditorGroupController {
    const themeService = overrides.themeService ?? new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorGroupController(
        themeService,
        overrides.registry ?? new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        overrides.languageService ?? NULL_LANGUAGE_SERVICE,
        overrides.configurationService ?? NULL_CONFIGURATION_SERVICE,
    );
}

/** Minimal IConfigurationService that serves a fixed key/value map. */
function stubConfigurationService(values: Record<string, unknown>): IConfigurationService {
    return {
        ...NULL_CONFIGURATION_SERVICE,
        get<T>(key: string, defaultValue?: T): T | undefined {
            return key in values ? (values[key] as T) : defaultValue;
        },
    };
}

describe("EditorGroupController", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
    }

    describe("openFile", () => {
        it("opens a file and creates a tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp = writeFile("hello.ts", "const x = 1;");

            ctrl.openFile(fp);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("hello.ts");
        });

        it("opens multiple files", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp1 = writeFile("a.ts", "a");
            const fp2 = writeFile("b.ts", "b");

            ctrl.openFile(fp1);
            ctrl.openFile(fp2);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(1);
        });

        it("switches to existing tab if file already open", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp = writeFile("a.ts", "a");

            ctrl.openFile(fp);
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.openFile(fp);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(0);
        });
    });

    describe("activateTab", () => {
        it("switches to the specified tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.activateTab(0);

            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("ignores out-of-range index", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.activateTab(5);

            expect(ctrl.activeIndex).toBe(0);
        });

        it("updates view content to the active editor", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            const editorA = ctrl.getActiveEditor();
            ctrl.activateTab(0);
            const content = ctrl.view.getContent();
            expect(content).toBeDefined();
        });
    });

    describe("closeTab", () => {
        it("closes the only tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.closeTab(0);

            expect(ctrl.editorCount).toBe(0);
            expect(ctrl.activeIndex).toBe(-1);
            expect(ctrl.view.getContent()).toBeNull();
        });

        it("closes middle tab and adjusts activeIndex", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.openFile(writeFile("c.ts", "c"));
            ctrl.activateTab(1);

            ctrl.closeTab(1);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("closes last tab and activates previous", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.closeTab(1);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("closes first tab when second is active", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.activateTab(1);

            ctrl.closeTab(0);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
        });
    });

    describe("syncTabs", () => {
        it("updates tab strip with current file names", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items).toHaveLength(2);
            expect(items[0].getLabel()).toBe("a.ts");
            expect(items[1].getLabel()).toBe("b.ts");
        });

        it("sets active index on tab strip", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            expect(ctrl.view.tabStrip.activeIndex).toBe(1);

            ctrl.activateTab(0);
            expect(ctrl.view.tabStrip.activeIndex).toBe(0);
        });
    });

    describe("modified state", () => {
        it("tab becomes modified after document edit", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp = writeFile("a.ts", "const x = 1;");

            ctrl.openFile(fp);
            const editor = ctrl.getActiveEditor()!;
            editor.viewState.insertText("y");

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items[0].getModified()).toBe(true);
        });

        it("tab becomes not-modified after save", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp = writeFile("a.ts", "const x = 1;");

            ctrl.openFile(fp);
            const editor = ctrl.getActiveEditor()!;
            editor.viewState.insertText("y");
            editor.save();

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items[0].getModified()).toBe(false);
        });
    });

    describe("tab callbacks", () => {
        it("onTabActivate switches to the clicked tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.view.tabStrip.onTabActivate?.(0);

            expect(ctrl.activeIndex).toBe(0);
        });

        it("onTabClose closes the clicked tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.view.tabStrip.onTabClose?.(0);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
        });

        it("onTabClose on a modified editor defers to onRequestConfirmClose instead of closing", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "const x = 1;"));
            const editor = ctrl.getActiveEditor()!;
            editor.viewState.insertText("y"); // mark modified

            let confirmedIndex = -1;
            ctrl.onRequestConfirmClose = (index) => {
                confirmedIndex = index;
            };

            ctrl.view.tabStrip.onTabClose?.(0);

            expect(confirmedIndex).toBe(0);
            expect(ctrl.editorCount).toBe(1); // not closed — waiting on confirmation
        });
    });

    describe("activate", () => {
        it("activates every open editor without throwing", async () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            await expect(ctrl.activate()).resolves.toBeUndefined();
        });
    });

    describe("applies configuration to new editors", () => {
        it("seeds indent options from the configuration service", () => {
            const ctrl = createEditorGroupController({
                configurationService: stubConfigurationService({
                    "editor.tabSize": 2,
                    "editor.insertSpaces": true,
                }),
            });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "const x = 1;"));

            const editor = ctrl.getActiveEditor()!;
            expect(editor.viewState.tabSize).toBe(2);
            expect(editor.viewState.insertSpaces).toBe(true);
        });
    });

    describe("language detection", () => {
        it("picks the registered tokenizer when the language service resolves a language id", () => {
            const registry = new TokenizationRegistry();
            registry.register("typescript", new PlainTextTokenizer());
            const languageService: ILanguageService = {
                getLanguageIdForResource: () => "typescript",
                getLanguageDisplayName: () => undefined,
            };
            const ctrl = createEditorGroupController({ registry, languageService });
            ctrl.mount();

            ctrl.openFile(writeFile("a.ts", "const x = 1;"));

            // The file opened successfully through the language-resolved path.
            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.getActiveEditor()?.getText()).toBe("const x = 1;");
        });
    });

    describe("activateTab without focus", () => {
        it("switches tabs without moving focus when focus: false", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.activateTab(0, { focus: false });

            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });
    });

    describe("closeTab edge cases", () => {
        it("ignores an out-of-range index", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.closeTab(99);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
        });

        it("closing a tab after the active one keeps the active index", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.openFile(writeFile("c.ts", "c"));
            ctrl.activateTab(0);

            // index 2 is after the active index 0 → active index is untouched.
            ctrl.closeTab(2);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });
    });

    describe("onActiveEditorChanged subscription", () => {
        it("fires the listener and stops after dispose", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            const seen: (string | null)[] = [];
            const subscription = ctrl.onActiveEditorChanged((editor) => {
                seen.push(editor?.fileName ?? null);
            });

            ctrl.openFile(writeFile("a.ts", "a"));
            expect(seen).toEqual(["a.ts"]);

            subscription.dispose();
            // Disposing again is a no-op (listener already removed).
            subscription.dispose();

            ctrl.openFile(writeFile("b.ts", "b"));
            expect(seen).toEqual(["a.ts"]);
        });
    });

    describe("applyConfigurationToEditor partial options", () => {
        it("applies only tabSize when insertSpaces is not configured", () => {
            const ctrl = createEditorGroupController({
                configurationService: stubConfigurationService({ "editor.tabSize": 8 }),
            });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "x"));

            expect(ctrl.getActiveEditor()?.viewState.tabSize).toBe(8);
        });

        it("applies only insertSpaces when tabSize is not configured", () => {
            const ctrl = createEditorGroupController({
                configurationService: stubConfigurationService({ "editor.insertSpaces": false }),
            });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "x"));

            expect(ctrl.getActiveEditor()?.viewState.insertSpaces).toBe(false);
        });
    });

    describe("applyTheme with missing colors", () => {
        it("does not throw when the theme omits editor foreground/background", () => {
            const emptyTheme = new WorkbenchTheme("empty", "dark", {}, { rules: [] });
            const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
            const ctrl = createEditorGroupController({ themeService });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            // Re-applies the theme with no editor.foreground / editor.background defined.
            expect(() => {
                themeService.setTheme(emptyTheme);
            }).not.toThrow();
        });
    });
});
