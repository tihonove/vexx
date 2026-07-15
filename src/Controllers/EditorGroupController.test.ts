import * as fs from "node:fs";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfiguration } from "../Configuration/ConfigurationService.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
import { Uri } from "../Common/Uri.ts";
import { resolveUserDataPaths } from "../Common/UserDataPaths.ts";
import { EndOfLine } from "../Editor/EndOfLine.ts";
import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorGroupController } from "./EditorGroupController.ts";
import { NULL_FILE_WATCHER } from "../Common/IFileWatcher.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

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
        new UndoRedoService(),
        NULL_FILE_WATCHER,
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
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-test-" });
        tmpDir = ws.dir;
    });

    afterEach(() => {
        ws.dispose();
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
    }

    function tabLabels(ctrl: EditorGroupController): string[] {
        return ctrl.view.tabStrip.getItemElements().map((item) => item.getLabel());
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

        it("opens two files with the same name from different directories as separate tabs", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp1 = writeFile(path.join("a", "index.ts"), "a");
            const fp2 = writeFile(path.join("b", "index.ts"), "b");

            ctrl.openFile(fp1);
            ctrl.openFile(fp2);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(1);
        });

        it("disambiguates tabs by parent directory when names collide", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.openFile(writeFile("standalone.ts", "s"));
            expect(tabLabels(ctrl)).toEqual(["standalone.ts"]);

            ctrl.openFile(writeFile(path.join("a", "index.ts"), "a"));
            ctrl.openFile(writeFile(path.join("b", "index.ts"), "b"));

            expect(tabLabels(ctrl)).toEqual(["standalone.ts", "index.ts — a", "index.ts — b"]);
        });

        it("disambiguates same-named files while untitled buffers keep their own labels", () => {
            // Смешанный случай: безымянные буферы не участвуют в разводке тёзок (их метки
            // уникальны по построению), а их uri не file — путь у них брать нельзя.
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.newUntitled();
            ctrl.openFile(writeFile(path.join("a", "index.ts"), "a"));
            ctrl.newUntitled();
            ctrl.openFile(writeFile(path.join("b", "index.ts"), "b"));

            expect(tabLabels(ctrl)).toEqual(["Untitled-1", "index.ts — a", "Untitled-2", "index.ts — b"]);
        });

        it("extends the disambiguating suffix when parent directories also collide", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.openFile(writeFile(path.join("x", "common", "index.ts"), "x"));
            ctrl.openFile(writeFile(path.join("y", "common", "index.ts"), "y"));

            const sep = path.sep;
            expect(tabLabels(ctrl)).toEqual([`index.ts — x${sep}common`, `index.ts — y${sep}common`]);
        });
    });

    describe("newUntitled", () => {
        it("opens a path-less buffer labeled Untitled-1, incrementing per buffer", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.newUntitled();
            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.getActiveEditor()?.absoluteFilePath).toBeNull();
            expect(tabLabels(ctrl)).toEqual(["Untitled-1"]);

            ctrl.newUntitled();
            expect(tabLabels(ctrl)).toEqual(["Untitled-1", "Untitled-2"]);
        });

        it("does not reuse a number after an untitled buffer is closed", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.newUntitled();
            ctrl.newUntitled();
            ctrl.closeTab(0);
            ctrl.newUntitled();

            expect(tabLabels(ctrl)).toEqual(["Untitled-2", "Untitled-3"]);
        });

        it("relabels to the basename after the buffer is saved to a path", async () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();

            ctrl.newUntitled();
            await ctrl.getActiveEditor()!.saveAs(path.join(tmpDir, "note.txt"));

            expect(tabLabels(ctrl)).toEqual(["note.txt"]);
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

    describe("MRU cycling (cycleMru)", () => {
        function openThree(ctrl: EditorGroupController): void {
            ctrl.openFile(writeFile("a.ts", "a")); // index 0
            ctrl.openFile(writeFile("b.ts", "b")); // index 1
            ctrl.openFile(writeFile("c.ts", "c")); // index 2, active; MRU: c, b, a
        }

        function mruNames(ctrl: EditorGroupController): (string | null)[] {
            return ctrl.getMruOrder().map((e) => e.fileName);
        }

        it("Ctrl+Tab activates the previously used editor, not the next tab by position", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl);

            // Active is c (last). MRU order is c, b, a → Ctrl+Tab picks b, not (wrap to) a.
            ctrl.cycleMru(1);

            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
            expect(ctrl.activeIndex).toBe(1);
        });

        it("stepping deeper walks the frozen MRU stack instead of toggling two editors", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            ctrl.cycleMru(1); // → b
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
            ctrl.cycleMru(1); // → a (deeper, not back to c)
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
            ctrl.cycleMru(1); // → c (wrap around)
            expect(ctrl.getActiveEditor()?.fileName).toBe("c.ts");
        });

        it("Ctrl+Shift+Tab steps toward more recent editors", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a, active c

            // From the top of the stack, going up wraps to the least-recent editor.
            ctrl.cycleMru(-1);

            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("MRU order reflects the actual usage history, not tab position", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            ctrl.activateTab(0); // click a → MRU: a, c, b
            expect(mruNames(ctrl)).toEqual(["a.ts", "c.ts", "b.ts"]);

            // Now Ctrl+Tab from a goes to c (the next most-recent), not b (next tab).
            ctrl.cycleMru(1);
            expect(ctrl.getActiveEditor()?.fileName).toBe("c.ts");
        });

        it("a fresh cycle re-snapshots the MRU order after an edit commits the selection", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            ctrl.cycleMru(1); // → b (not yet committed to MRU front)
            // A normal activation (e.g. click) ends the cycle and commits.
            ctrl.activateTab(1); // stay on b, but now commit → MRU: b, c, a

            ctrl.cycleMru(1); // fresh cycle from b → next most-recent is c
            expect(ctrl.getActiveEditor()?.fileName).toBe("c.ts");
        });

        it("releasing Ctrl commits the selection so quick presses toggle the two newest", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            // Press-release Ctrl+Tab: one step, then commit on release.
            ctrl.cycleMru(1); // → b
            ctrl.endMruCycle(); // release Ctrl → commit → MRU: b, c, a
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
            expect(mruNames(ctrl)).toEqual(["b.ts", "c.ts", "a.ts"]);

            // Next press-release toggles back to c, not deeper to a.
            ctrl.cycleMru(1); // → c
            ctrl.endMruCycle(); // MRU: c, b, a
            expect(ctrl.getActiveEditor()?.fileName).toBe("c.ts");

            ctrl.cycleMru(1); // → b again (toggle)
            ctrl.endMruCycle();
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
        });

        it("keeps stepping deeper while Ctrl is held (no endMruCycle between steps)", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            // Ctrl held: repeated Tab without a release walks the frozen stack.
            ctrl.cycleMru(1); // → b
            ctrl.cycleMru(1); // → a
            ctrl.endMruCycle(); // release Ctrl → commit a
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
            expect(mruNames(ctrl)).toEqual(["a.ts", "c.ts", "b.ts"]);
        });

        it("endMruCycle is a no-op when no series is in progress", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            ctrl.endMruCycle(); // nothing to commit
            expect(mruNames(ctrl)).toEqual(["c.ts", "b.ts", "a.ts"]);
            expect(ctrl.getActiveEditor()?.fileName).toBe("c.ts");
        });

        it("is a no-op with fewer than two editors", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.cycleMru(1);

            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("keeps the MRU stack consistent after closing a tab", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            openThree(ctrl); // MRU: c, b, a

            ctrl.closeTab(2); // close active c → b becomes active
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
            expect(mruNames(ctrl)).toEqual(["b.ts", "a.ts"]);

            // Cycling now only sees the two remaining editors.
            ctrl.cycleMru(1);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("reopening an already-open file promotes it to the MRU front", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fpA = writeFile("a.ts", "a");
            ctrl.openFile(fpA);
            ctrl.openFile(writeFile("b.ts", "b")); // MRU: b, a
            ctrl.openFile(fpA); // re-focus a → MRU: a, b

            expect(mruNames(ctrl)).toEqual(["a.ts", "b.ts"]);
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

        it("tab becomes not-modified after save", async () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const fp = writeFile("a.ts", "const x = 1;");

            ctrl.openFile(fp);
            const editor = ctrl.getActiveEditor()!;
            editor.viewState.insertText("y");
            await editor.save();

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items[0].getModified()).toBe(false);
        });

        it("tab becomes modified immediately after an EOL conversion", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a\nb"));

            ctrl.getActiveEditor()!.setEol(EndOfLine.CRLF);

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items[0].getModified()).toBe(true);
        });

        it("tab clears the modified marker after undoing an EOL conversion", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a\nb"));
            const editor = ctrl.getActiveEditor()!;

            editor.setEol(EndOfLine.CRLF);
            editor.undo();

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

        it("seeds cursorSurroundingLines from the configuration service", () => {
            const ctrl = createEditorGroupController({
                configurationService: stubConfigurationService({
                    "editor.cursorSurroundingLines": 5,
                }),
            });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "const x = 1;"));

            expect(ctrl.getActiveEditor()!.viewState.cursorSurroundingLines).toBe(5);
        });
    });

    describe("live-reloads editor settings into already-open editors", () => {
        // Real ConfigurationService over a temp settings.json — editing the file and
        // calling reload() emits onDidChangeConfiguration, which the group must apply
        // to editors that are ALREADY open (not just newly created ones).
        async function realConfig(initial: string) {
            const cfgWs = createTempWorkspace({ prefix: "vexx-egc-cfg-" });
            const p = resolveUserDataPaths({ homedir: "/never", userDataDir: cfgWs.dir });
            const write = (content: string): void => {
                fs.mkdirSync(path.dirname(p.settingsFile), { recursive: true });
                fs.writeFileSync(p.settingsFile, content, "utf-8");
            };
            write(initial);
            const cfg = await loadConfiguration(p);
            return { cfg, write, dispose: () => cfgWs.dispose() };
        }

        it("re-applies editor.tabSize / insertSpaces to an open editor", async () => {
            const { cfg, write, dispose } = await realConfig(
                `{ "editor.tabSize": 2, "editor.insertSpaces": true }`,
            );
            const ctrl = createEditorGroupController({ configurationService: cfg });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "const x = 1;"));
            const editor = ctrl.getActiveEditor()!;
            expect(editor.viewState.tabSize).toBe(2);

            write(`{ "editor.tabSize": 8, "editor.insertSpaces": false }`);
            await cfg.reload();

            expect(editor.viewState.tabSize).toBe(8);
            expect(editor.viewState.insertSpaces).toBe(false);

            ctrl.dispose();
            dispose();
        });

        it("does not touch editors when only non-editor settings change", async () => {
            const { cfg, write, dispose } = await realConfig(`{ "editor.tabSize": 2 }`);
            const ctrl = createEditorGroupController({ configurationService: cfg });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "const x = 1;"));
            const editor = ctrl.getActiveEditor()!;
            expect(editor.viewState.tabSize).toBe(2);

            // Only a workbench key changes → affectsConfiguration("editor") is false,
            // the group's handler early-returns and the editor is left as-is.
            write(`{ "editor.tabSize": 2, "workbench.colorTheme": "Monokai" }`);
            await cfg.reload();

            expect(editor.viewState.tabSize).toBe(2);

            ctrl.dispose();
            dispose();
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
        it("uses the default color registry when the theme omits editor foreground/background", () => {
            // A theme with no colors at all: the dark default registry supplies
            // editor.foreground / editor.background, so applyTheme never throws and
            // the editor group is always colored.
            const emptyTheme = WorkbenchTheme.fromThemeFile({ name: "empty", type: "dark", colors: {} });
            const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
            const ctrl = createEditorGroupController({ themeService });
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            expect(() => {
                themeService.setTheme(emptyTheme);
            }).not.toThrow();
            expect(ctrl.view.style.fg).toBe(0xd4d4d4); // default dark "editor.foreground"
            expect(ctrl.view.style.bg).toBe(0x1e1e1e); // default dark "editor.background"
        });
    });

    describe("save participant & onEditorSaved", () => {
        it("раздаёт saveParticipant существующим и будущим редакторам", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.txt", "x"));

            const participant = (): Promise<never[]> => Promise.resolve([]);
            ctrl.saveParticipant = participant;
            expect(ctrl.saveParticipant).toBe(participant);
            expect(ctrl.getActiveEditor()?.saveParticipant).toBe(participant);

            // Новый редактор получает участника при открытии.
            ctrl.openFile(writeFile("b.txt", "y"));
            expect(ctrl.getEditor(1)?.saveParticipant).toBe(participant);
        });

        it("onEditorSaved стреляет при сохранении и отписывается через dispose", async () => {
            const ctrl = createEditorGroupController({
                languageService: {
                    getLanguageIdForResource: (f) => (f.endsWith(".ts") ? "typescript" : undefined),
                    getLanguageDisplayName: () => undefined,
                },
            });
            ctrl.mount();
            const fp = writeFile("a.ts", "x");
            ctrl.openFile(fp);

            const seen: { uri: string; languageId: string }[] = [];
            const sub = ctrl.onEditorSaved((m) => seen.push(m));
            await ctrl.getActiveEditor()?.save();
            expect(seen).toEqual([{ uri: Uri.file(fp).toString(), languageId: "typescript" }]);

            sub.dispose();
            sub.dispose(); // повторный dispose — no-op (idx === -1)
            await ctrl.getActiveEditor()?.save();
            expect(seen).toHaveLength(1);
        });
    });

    describe("getOpenFilePaths", () => {
        it("returns file paths in tab order and skips untitled buffers", () => {
            const ctrl = createEditorGroupController();
            ctrl.mount();
            const a = writeFile("a.ts", "A");
            const b = writeFile("b.ts", "B");
            ctrl.openFile(a);
            ctrl.newUntitled(); // без пути на диске — в снимок не попадает
            ctrl.openFile(b);
            expect(ctrl.getOpenFilePaths()).toEqual([a, b]);
        });
    });
});
