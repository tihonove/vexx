import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EndOfLine } from "../../Editor/EndOfLine.ts";

import { CommandRegistryDIToken } from "../../Controllers/CommandRegistry.ts";
import type { CommandRegistry } from "../../Controllers/CommandRegistry.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../../Controllers/EditorGroupController.ts";
import { createTestContainer } from "../../Controllers/Modules/TestProfile.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "./StatusBarComponent.ts";

function createStatusBarComponent(): {
    statusBarController: StatusBarComponent;
    editorGroupController: EditorGroupController;
    commands: CommandRegistry;
} {
    const { container } = createTestContainer();
    const editorGroupController = container.get(EditorGroupControllerDIToken);
    const statusBarController = container.get(StatusBarComponentDIToken);
    const commands = container.get(CommandRegistryDIToken);
    editorGroupController.mount();
    statusBarController.mount();
    return { statusBarController, editorGroupController, commands };
}

function itemTexts(statusBarController: StatusBarComponent): string[] {
    return statusBarController.view.getItems().map((item) => item.text);
}

describe("StatusBarComponent — encoding & EOL segments", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        // Детерминированное окружение: сегмент терминала — "legacy" без модов.
        delete process.env.TMUX;
        delete process.env.TMUX_PANE;
        delete process.env.SSH_CONNECTION;
        delete process.env.SSH_CLIENT;
        delete process.env.SSH_TTY;
        delete process.env.COLORTERM;
        delete process.env.KITTY_WINDOW_ID;
        delete process.env.GHOSTTY_RESOURCES_DIR;
        delete process.env.WEZTERM_PANE;
        delete process.env.ALACRITTY_WINDOW_ID;
        delete process.env.TERM_PROGRAM;
        process.env.TERM = "xterm-256color";
    });

    afterEach(() => {
        process.env = savedEnv;
    });

    it("без активного редактора сегментов Encoding/EOL нет", () => {
        const { statusBarController } = createStatusBarComponent();
        expect(itemTexts(statusBarController)).toEqual(["legacy"]);
    });

    it("порядок правых сегментов как в VS Code: Ln/Col · Encoding · EOL · Language", () => {
        const { statusBarController, editorGroupController } = createStatusBarComponent();
        editorGroupController.openFile("/tmp/test-statusbar-enc-order.txt");
        statusBarController.update();

        expect(itemTexts(statusBarController)).toEqual(["legacy", "Ln 1, Col 1", "UTF-8", "LF", "plaintext"]);
    });

    it("сегмент кодировки показывает statusLabel и трекает setEncoding без ручного update()", () => {
        const { statusBarController, editorGroupController } = createStatusBarComponent();
        editorGroupController.openFile("/tmp/test-statusbar-enc-live.txt");

        editorGroupController.getActiveEditor()!.setEncoding("windows1251");

        expect(itemTexts(statusBarController)).toContain("Windows 1251");
    });

    it("сегмент EOL трекает setEol без ручного update()", () => {
        const { statusBarController, editorGroupController } = createStatusBarComponent();
        editorGroupController.openFile("/tmp/test-statusbar-eol-live.txt");

        editorGroupController.getActiveEditor()!.setEol(EndOfLine.CRLF);

        expect(itemTexts(statusBarController)).toContain("CRLF");
        expect(itemTexts(statusBarController)).not.toContain("LF");
    });

    it("клик по сегментам исполняет команды changeEncoding / changeEOL", () => {
        const { statusBarController, editorGroupController, commands } = createStatusBarComponent();
        editorGroupController.openFile("/tmp/test-statusbar-enc-click.txt");
        statusBarController.update();

        const executed: string[] = [];
        commands.register("workbench.action.editor.changeEncoding", () => executed.push("enc"));
        commands.register("workbench.action.editor.changeEOL", () => executed.push("eol"));

        const items = statusBarController.view.getItems();
        items.find((item) => item.text === "UTF-8")!.onClick!();
        items.find((item) => item.text === "LF")!.onClick!();

        expect(executed).toEqual(["enc", "eol"]);
    });

    it("переподписывается при смене активного редактора", () => {
        const { statusBarController, editorGroupController } = createStatusBarComponent();
        editorGroupController.openFile("/tmp/test-statusbar-enc-tab1.txt");
        const firstEditor = editorGroupController.getActiveEditor()!;
        editorGroupController.openFile("/tmp/test-statusbar-enc-tab2.txt");

        // Смена кодировки НЕактивного редактора сегмент не трогает.
        firstEditor.setEncoding("koi8r");
        expect(itemTexts(statusBarController)).toContain("UTF-8");

        // Смена у активного — обновляет.
        editorGroupController.getActiveEditor()!.setEncoding("windows1251");
        expect(itemTexts(statusBarController)).toContain("Windows 1251");
    });
});
