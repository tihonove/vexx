import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { EndOfLine } from "../../Editor/EndOfLine.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../CommandAction.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../CommandRegistry.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { KeybindingRegistry } from "../KeybindingRegistry.ts";
import { StatusBarComponentDIToken } from "../../Workbench/StatusBar/StatusBarComponent.ts";
import { UndoRedoService } from "../Workspace/UndoRedoService.ts";

import { convertToCrlfAction, convertToLfAction, toggleEolAction } from "./EolActions.ts";

let ws: ITempWorkspace;

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
    // Stub StatusBarComponent — the actions only call update().
    accessor.bind(StatusBarComponentDIToken, () => ({ update() {} }) as never);

    function exec(action: CommandAction): void {
        registerAction(commands, keybindings, accessor, action);
        commands.execute(action.id);
    }
    return { ctrl, editor, exec, filePath };
}

beforeEach(() => {
    ws = createTempWorkspace({ prefix: "vexx-eol-actions-" });
});
afterEach(() => {
    ws.dispose();
});

describe("EolActions", () => {
    it("Convert to CRLF changes the active editor's eol and marks it modified", () => {
        const { editor, exec } = openEditor("a\nb");
        expect(editor.eol).toBe(EndOfLine.LF);

        exec(convertToCrlfAction);

        expect(editor.eol).toBe(EndOfLine.CRLF);
        expect(editor.isModified).toBe(true);
    });

    it("Convert to LF changes a CRLF document back to LF", () => {
        const { editor, exec } = openEditor("a\r\nb");
        expect(editor.eol).toBe(EndOfLine.CRLF);

        exec(convertToLfAction);

        expect(editor.eol).toBe(EndOfLine.LF);
    });

    it("Convert to CRLF then save writes CRLF bytes to disk", async () => {
        const { editor, exec, filePath } = openEditor("a\nb\nc");
        exec(convertToCrlfAction);
        await editor.save();
        expect(fs.readFileSync(filePath, "utf-8")).toBe("a\r\nb\r\nc");
    });

    it("Toggle flips LF <-> CRLF", () => {
        const { editor, exec } = openEditor("a\nb");

        exec(toggleEolAction);
        expect(editor.eol).toBe(EndOfLine.CRLF);

        exec(toggleEolAction);
        expect(editor.eol).toBe(EndOfLine.LF);
    });

    it("actions are no-ops when there is no active editor", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ({ getActiveEditor: () => null }) as never);
        accessor.bind(StatusBarComponentDIToken, () => ({ update() {} }) as never);

        for (const action of [convertToLfAction, convertToCrlfAction, toggleEolAction]) {
            registerAction(commands, keybindings, accessor, action);
            expect(() => commands.execute(action.id)).not.toThrow();
        }
    });
});
