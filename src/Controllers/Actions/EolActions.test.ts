import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { EndOfLine } from "../../Editor/EndOfLine.ts";
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
import { KeybindingRegistry } from "../KeybindingRegistry.ts";
import { StatusBarControllerDIToken } from "../StatusBarController.ts";
import { UndoRedoService } from "../Workspace/UndoRedoService.ts";

import { convertToCrlfAction, convertToLfAction, toggleEolAction } from "./EolActions.ts";

let tmpDir: string;

function openEditor(content: string) {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const ctrl = new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
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
    // Stub StatusBarController — the actions only call update().
    accessor.bind(StatusBarControllerDIToken, () => ({ update() {} }) as never);

    function exec(action: CommandAction): void {
        registerAction(commands, keybindings, accessor, action);
        commands.execute(action.id);
    }
    return { ctrl, editor, exec, filePath };
}

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-eol-actions-"));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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

    it("Convert to CRLF then save writes CRLF bytes to disk", () => {
        const { editor, exec, filePath } = openEditor("a\nb\nc");
        exec(convertToCrlfAction);
        editor.save();
        expect(fs.readFileSync(filePath, "utf-8")).toBe("a\r\nb\r\nc");
    });

    it("Toggle flips LF <-> CRLF", () => {
        const { editor, exec } = openEditor("a\nb");

        exec(toggleEolAction);
        expect(editor.eol).toBe(EndOfLine.CRLF);

        exec(toggleEolAction);
        expect(editor.eol).toBe(EndOfLine.LF);
    });
});
