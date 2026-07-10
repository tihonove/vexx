import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../CommandAction.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../CommandRegistry.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { NULL_FILE_WATCHER } from "../IFileWatcher.ts";
import { KeybindingRegistry } from "../KeybindingRegistry.ts";
import { UndoRedoService } from "../Workspace/UndoRedoService.ts";

import { foldAction, foldAllAction, toggleFoldAction, unfoldAction, unfoldAllAction } from "./FoldingActions.ts";

let tmpDir: string;

function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// 0: a          ← outer region 0..3
// 1:   b        ← inner region 1..2
// 2:     c
// 3:   d
const NESTED = "a\n  b\n    c\n  d";

function openEditor(content: string) {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const ctrl = new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
        NULL_FILE_WATCHER,
    );
    ctrl.mount();
    const filePath = path.join(tmpDir, "doc.txt");
    fs.writeFileSync(filePath, content, "utf-8");
    ctrl.openFile(filePath);
    const editor = ctrl.getActiveEditor();
    if (editor === null) throw new Error("no active editor");

    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const accessor = new Container();
    accessor.bind(EditorGroupControllerDIToken, () => ctrl);

    function exec(action: CommandAction): void {
        registerAction(commands, keybindings, accessor, action);
        commands.execute(action.id);
    }
    return { ctrl, editor, exec };
}

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-folding-actions-"));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("FoldingActions", () => {
    it("computes indentation regions on open", () => {
        const { editor } = openEditor(NESTED);
        expect(editor.viewState.foldedRegions.map((r) => [r.startLine, r.endLine])).toEqual([
            [0, 3],
            [1, 2],
        ]);
    });

    it("Fold collapses the innermost region at the cursor", () => {
        const { editor, exec } = openEditor(NESTED);
        editor.viewState.selections = [{ anchor: { line: 2, character: 0 }, active: { line: 2, character: 0 } }];
        exec(foldAction);
        expect(editor.viewState.foldingRegionContaining(1)?.isCollapsed).toBe(true);
    });

    it("Unfold expands a collapsed region at the cursor", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(foldAllAction);
        exec(unfoldAction); // cursor at line 0 → outer region
        expect(editor.viewState.foldedRegions.find((r) => r.startLine === 0)?.isCollapsed).toBe(false);
    });

    it("Fold All collapses every region", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(foldAllAction);
        expect(editor.viewState.foldedRegions.every((r) => r.isCollapsed)).toBe(true);
    });

    it("Unfold All expands every region", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(foldAllAction);
        exec(unfoldAllAction);
        expect(editor.viewState.foldedRegions.every((r) => !r.isCollapsed)).toBe(true);
    });

    it("Toggle Fold flips the region at the cursor", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(toggleFoldAction);
        expect(editor.viewState.foldingRegionContaining(0)?.isCollapsed).toBe(true);
        exec(toggleFoldAction);
        expect(editor.viewState.foldingRegionContaining(0)?.isCollapsed).toBe(false);
    });

    it("preserves collapsed state across an unrelated edit", async () => {
        // 0: a          ← region 0..2 (collapsed)
        // 1:   b
        // 2:   c
        // 3: d          ← edit here, outside the region
        const { editor } = openEditor("a\n  b\n  c\nd");
        editor.viewState.foldRegionContaining(0);
        expect(editor.viewState.foldingRegionContaining(0)?.isCollapsed).toBe(true);

        editor.viewState.selections = [{ anchor: { line: 3, character: 1 }, active: { line: 3, character: 1 } }];
        editor.pushUndo(editor.viewState.type("x"));
        await flushMicrotasks();

        // Region survives the recompute and stays collapsed.
        expect(editor.viewState.foldingRegionContaining(0)?.isCollapsed).toBe(true);
    });

    it("shifts a collapsed region down when a line is inserted above it", async () => {
        // 0: top       ← insert a newline at the end of this line
        // 1: a          ← region 1..3 (collapsed)
        // 2:   b
        // 3:   c
        // 4: d
        const { editor } = openEditor("top\na\n  b\n  c\nd");
        editor.viewState.foldRegionContaining(1);
        expect(editor.viewState.foldingRegionContaining(1)?.isCollapsed).toBe(true);

        editor.viewState.selections = [{ anchor: { line: 0, character: 3 }, active: { line: 0, character: 3 } }];
        editor.pushUndo(editor.viewState.insertNewLine());
        await flushMicrotasks();

        // The header shifted from line 1 to line 2 and stays collapsed.
        const region = editor.viewState.foldedRegions.find((r) => r.startLine === 2);
        expect(region?.isCollapsed).toBe(true);
    });

    it("keeps expanded regions expanded across a recompute", async () => {
        // No fold applied — the recompute after the edit sees an expanded region.
        const { editor } = openEditor("a\n  b\n  c\nd");
        editor.viewState.selections = [{ anchor: { line: 3, character: 1 }, active: { line: 3, character: 1 } }];
        editor.pushUndo(editor.viewState.type("x"));
        await flushMicrotasks();
        expect(editor.viewState.foldedRegions).toHaveLength(1);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("drops regions that no longer exist after an edit", async () => {
        const { editor } = openEditor("a\n  b\n  c");
        expect(editor.viewState.foldedRegions).toHaveLength(1);
        // Select all and replace with a flat document → no regions.
        editor.viewState.selectAll();
        editor.pushUndo(editor.viewState.type("flat"));
        await flushMicrotasks();
        expect(editor.viewState.foldedRegions).toHaveLength(0);
    });

    it("actions are no-ops when there is no active editor", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ({ getActiveEditor: () => null }) as never);

        for (const action of [foldAction, unfoldAction, toggleFoldAction, foldAllAction, unfoldAllAction]) {
            registerAction(commands, keybindings, accessor, action);
            expect(() => commands.execute(action.id)).not.toThrow();
        }
    });
});
