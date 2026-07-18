import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import { OscClipboard } from "../../Common/OscClipboard.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { createCursorSelection, createSelection } from "../../Editor/ISelection.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../CommandAction.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../../Workbench/Services/CommandRegistry.ts";
import { ClipboardDIToken } from "../../Workbench/Services/CoreTokens.ts";
import { EditorGroupController } from "../EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { KeybindingRegistry } from "../../Workbench/Services/KeybindingRegistry.ts";
import { UndoRedoService } from "../../Workbench/Services/Workspace/UndoRedoService.ts";

import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./ClipboardActions.ts";

/** A real (in-memory) clipboard — not a spy. */
function memoryClipboard(initial = ""): IClipboard {
    let text = initial;
    return {
        readText: () => Promise.resolve(text),
        writeText: (value: string) => {
            text = value;
            return Promise.resolve();
        },
    };
}

let ws: ITempWorkspace;

function createGroup(): EditorGroupController {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
        NULL_FILE_WATCHER,
    );
}

function openEditor(content: string, clipboard: IClipboard) {
    const ctrl = createGroup();
    ctrl.mount();
    const filePath = ws.writeFile("doc.txt", content);
    ctrl.openFile(filePath);
    const editor = ctrl.getActiveEditor();
    if (editor === null) throw new Error("no active editor");

    const commands = new CommandRegistry();
    const accessor = new Container();
    accessor.bind(EditorGroupControllerDIToken, () => ctrl);
    accessor.bind(ClipboardDIToken, () => clipboard);

    async function exec(action: CommandAction): Promise<void> {
        registerAction(commands, new KeybindingRegistry(), accessor, action);
        await commands.execute(action.id);
    }
    return { ctrl, editor, exec };
}

beforeEach(() => {
    ws = createTempWorkspace({ prefix: "vexx-clipboard-actions-" });
});
afterEach(() => {
    ws.dispose();
});

describe("clipboardCopyAction", () => {
    it("copies the selected text to the clipboard without changing the document", async () => {
        const clipboard = memoryClipboard();
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createSelection(0, 0, 0, 5)]; // "hello"

        await exec(clipboardCopyAction);

        expect(await clipboard.readText()).toBe("hello");
        expect(editor.getText()).toBe("hello world");
    });

    it("leaves the clipboard untouched when nothing is selected", async () => {
        const clipboard = memoryClipboard("previous");
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createCursorSelection(0, 3)];

        await exec(clipboardCopyAction);

        expect(await clipboard.readText()).toBe("previous");
    });
});

describe("clipboardCutAction", () => {
    it("copies the selection and removes it from the document", async () => {
        const clipboard = memoryClipboard();
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createSelection(0, 0, 0, 6)]; // "hello "

        await exec(clipboardCutAction);

        expect(await clipboard.readText()).toBe("hello ");
        expect(editor.getText()).toBe("world");
    });

    it("does nothing when the selection is empty", async () => {
        const clipboard = memoryClipboard("previous");
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createCursorSelection(0, 3)];

        await exec(clipboardCutAction);

        expect(await clipboard.readText()).toBe("previous");
        expect(editor.getText()).toBe("hello world");
    });
});

describe("clipboardPasteAction", () => {
    it("inserts the clipboard text at the cursor", async () => {
        const clipboard = memoryClipboard("XYZ");
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createCursorSelection(0, 5)];

        await exec(clipboardPasteAction);

        expect(editor.getText()).toBe("helloXYZ world");
    });

    it("replaces the active selection with the clipboard text", async () => {
        const clipboard = memoryClipboard("XYZ");
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createSelection(0, 0, 0, 5)]; // "hello"

        await exec(clipboardPasteAction);

        expect(editor.getText()).toBe("XYZ world");
    });

    it("does nothing when the clipboard is empty", async () => {
        const clipboard = memoryClipboard("");
        const { editor, exec } = openEditor("hello world", clipboard);
        editor.viewState.selections = [createCursorSelection(0, 5)];

        await exec(clipboardPasteAction);

        expect(editor.getText()).toBe("hello world");
    });
});

describe("clipboardCutAction defensive delete handling", () => {
    it("still copies to the clipboard but pushes no undo when the delete is a no-op", async () => {
        // A real editor with a non-empty selection always produces an undo on
        // deleteLeft(); this stub forces the defensive `if (undo)` false branch.
        const clipboard = memoryClipboard();
        const pushUndo = vi.fn();
        const editor = {
            viewState: {
                getSelectedText: () => "selected",
                deleteLeft: () => undefined,
            },
            pushUndo,
        };
        const commands = new CommandRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ({ getActiveEditor: () => editor }) as never);
        accessor.bind(ClipboardDIToken, () => clipboard);

        registerAction(commands, new KeybindingRegistry(), accessor, clipboardCutAction);
        await commands.execute(clipboardCutAction.id);

        expect(await clipboard.readText()).toBe("selected");
        expect(pushUndo).not.toHaveBeenCalled();
    });
});

describe("copy→paste round-trip via OscClipboard (internal register)", () => {
    it("pastes copied text instantly through the internal register, never querying the terminal", async () => {
        // Real OscClipboard: copy must mirror out via the OSC 52 *write* sequence, and a
        // subsequent paste must read back the register without emitting an OSC 52 read
        // query (`\x1b]52;c;?\x07`) — the round-trip that hangs in kitty+ssh+tmux.
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        const { editor, exec } = openEditor("hello world", clipboard);

        editor.viewState.selections = [createSelection(0, 0, 0, 5)]; // "hello"
        await exec(clipboardCopyAction);

        editor.viewState.selections = [createCursorSelection(0, 11)]; // end of line
        await exec(clipboardPasteAction);

        expect(editor.getText()).toBe("hello worldhello");
        // The only sequence ever written is the OSC 52 write from copy — no read query.
        expect(writeFn).toHaveBeenCalledOnce();
        expect(writeFn.mock.calls[0][0]).not.toContain("?");
    });
});

describe("clipboard actions without an active editor", () => {
    it("are safe no-ops", async () => {
        const ctrl = createGroup();
        ctrl.mount();
        const clipboard = memoryClipboard("data");
        const commands = new CommandRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ctrl);
        accessor.bind(ClipboardDIToken, () => clipboard);
        for (const action of [clipboardCopyAction, clipboardCutAction, clipboardPasteAction]) {
            registerAction(commands, new KeybindingRegistry(), accessor, action);
            await expect(commands.execute(action.id)).resolves.not.toThrow();
        }
    });
});
