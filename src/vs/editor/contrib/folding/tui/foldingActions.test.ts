import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../../../platform/instantiation/common/instantiation.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../../../platform/configuration/common/nullConfigurationService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../common/tokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { settle } from "../../../../../TestUtils/timing.ts";
import { darkPlusTheme } from "../../../../workbench/services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../../workbench/services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../workbench/services/themes/common/workbenchTheme.ts";
import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../../../../workbench/tui/parts/editor/editorGroupController.ts";
import { NULL_FILE_WATCHER } from "../../../../platform/files/common/watcher.ts";
import { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

import {
    foldAction,
    foldAllAction,
    foldLevelActions,
    foldRecursivelyAction,
    gotoNextFoldAction,
    gotoPreviousFoldAction,
    toggleFoldAction,
    unfoldAction,
    unfoldAllAction,
    unfoldRecursivelyAction,
} from "./foldingActions.ts";

let ws: ITempWorkspace;

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
    const filePath = ws.writeFile("doc.txt", content);
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
    ws = createTempWorkspace({ prefix: "vexx-folding-actions-" });
});
afterEach(() => {
    ws.dispose();
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
        await settle(0);

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
        await settle(0);

        // The header shifted from line 1 to line 2 and stays collapsed.
        const region = editor.viewState.foldedRegions.find((r) => r.startLine === 2);
        expect(region?.isCollapsed).toBe(true);
    });

    it("keeps expanded regions expanded across a recompute", async () => {
        // No fold applied — the recompute after the edit sees an expanded region.
        const { editor } = openEditor("a\n  b\n  c\nd");
        editor.viewState.selections = [{ anchor: { line: 3, character: 1 }, active: { line: 3, character: 1 } }];
        editor.pushUndo(editor.viewState.type("x"));
        await settle(0);
        expect(editor.viewState.foldedRegions).toHaveLength(1);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("drops regions that no longer exist after an edit", async () => {
        const { editor } = openEditor("a\n  b\n  c");
        expect(editor.viewState.foldedRegions).toHaveLength(1);
        // Select all and replace with a flat document → no regions.
        editor.viewState.selectAll();
        editor.pushUndo(editor.viewState.type("flat"));
        await settle(0);
        expect(editor.viewState.foldedRegions).toHaveLength(0);
    });

    it("Fold Recursively collapses the region at the cursor and everything nested", () => {
        const { editor, exec } = openEditor(NESTED); // cursor at line 0 → outer + inner
        exec(foldRecursivelyAction);
        expect(editor.viewState.foldedRegions.every((r) => r.isCollapsed)).toBe(true);
    });

    it("Unfold Recursively expands the region and everything nested", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(foldAllAction);
        exec(unfoldRecursivelyAction);
        expect(editor.viewState.foldedRegions.every((r) => !r.isCollapsed)).toBe(true);
    });

    it("Fold Level 2 folds the nested region but leaves the top level open", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(foldLevelActions[1]); // Fold Level 2
        expect(editor.viewState.foldedRegions.find((r) => r.startLine === 0)?.isCollapsed).toBe(false);
        expect(editor.viewState.foldedRegions.find((r) => r.startLine === 1)?.isCollapsed).toBe(true);
    });

    it("every Fold Level action (1..7) executes", () => {
        const { editor, exec } = openEditor(NESTED);
        for (const action of foldLevelActions) exec(action);
        // Fold Level 7 is deeper than the tree → everything ends up expanded.
        expect(editor.viewState.foldedRegions.every((r) => !r.isCollapsed)).toBe(true);
    });

    it("Go to Next / Previous Fold move the cursor between region headers", () => {
        const { editor, exec } = openEditor(NESTED);
        exec(gotoNextFoldAction); // from line 0 → inner header
        expect(editor.viewState.selections[0].active.line).toBe(1);
        exec(gotoPreviousFoldAction); // back to the outer header
        expect(editor.viewState.selections[0].active.line).toBe(0);
    });

    it("actions are no-ops when there is no active editor", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ({ getActiveEditor: () => null }) as never);

        for (const action of [
            foldAction,
            unfoldAction,
            toggleFoldAction,
            foldAllAction,
            unfoldAllAction,
            foldRecursivelyAction,
            unfoldRecursivelyAction,
            gotoNextFoldAction,
            gotoPreviousFoldAction,
            ...foldLevelActions,
        ]) {
            registerAction(commands, keybindings, accessor, action);
            expect(() => commands.execute(action.id)).not.toThrow();
        }
    });
});
