import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ILanguageService } from "../../../../editor/common/languages/language.ts";
import { ThemeServiceDIToken } from "../../../services/themes/common/themeTokens.ts";

import { EditorGroupController, EditorGroupControllerDIToken } from "../editor/editorGroupController.ts";
import { createTestContainer } from "../../../../vexx/modules/testProfile.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./statusBarController.ts";
import { TerminalEnvironmentServiceDIToken } from "../../../terminalEnvironment/terminalEnvironmentService.ts";

function createStatusBarController(languageService?: ILanguageService): {
    statusBarController: StatusBarController;
    editorGroupController: EditorGroupController;
} {
    const { container } = createTestContainer();
    const editorGroupController = container.get(EditorGroupControllerDIToken);

    // Кастомный ILanguageService — собираем контроллер руками; иначе берём
    // контейнерный (NULL_LANGUAGE_SERVICE из TestProfile).
    const statusBarController =
        languageService === undefined
            ? container.get(StatusBarControllerDIToken)
            : new StatusBarController(
                  editorGroupController,
                  container.get(ThemeServiceDIToken),
                  container.get(TerminalEnvironmentServiceDIToken),
                  languageService,
              );

    editorGroupController.mount();
    statusBarController.mount();

    return { statusBarController, editorGroupController };
}

describe("StatusBarController — language badge", () => {
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

    it("нет беджика без активного редактора", () => {
        const { statusBarController } = createStatusBarController();
        expect(statusBarController.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("показывает display name из ILanguageService, беджик правее Ln/Col", () => {
        const languageService: ILanguageService = {
            getLanguageIdForResource: () => undefined,
            getLanguageDisplayName: (id) => (id === "typescript" ? "TypeScript" : undefined),
        };
        const { statusBarController, editorGroupController } = createStatusBarController(languageService);

        editorGroupController.openFile("/tmp/test-statusbar-lang.ts");
        // Язык детектит сам редактор (в TestProfile — NULL-сервис → plaintext),
        // поэтому выставляем typescript явно через закладку setLanguage.
        editorGroupController.getActiveEditor()!.setLanguage("typescript");

        expect(statusBarController.view.getItems()).toEqual([
            { text: "legacy" },
            { text: "Ln 1, Col 1", align: "right" },
            { text: "TypeScript", align: "right" },
        ]);
    });

    it("откатывается на сырой language id без display name", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();

        editorGroupController.openFile("/tmp/test-statusbar-rawid.txt");
        statusBarController.update();

        expect(statusBarController.view.getItems()).toContainEqual({ text: "plaintext", align: "right" });
    });

    it("обновляется на setLanguage без ручного update()", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        editorGroupController.openFile("/tmp/test-statusbar-setlang.txt");

        editorGroupController.getActiveEditor()!.setLanguage("markdown");

        expect(statusBarController.view.getItems()).toContainEqual({ text: "markdown", align: "right" });
    });

    it("переподписывается при смене активного редактора", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        editorGroupController.openFile("/tmp/test-statusbar-tab1.txt");
        const firstEditor = editorGroupController.getActiveEditor()!;
        editorGroupController.openFile("/tmp/test-statusbar-tab2.txt");

        // Смена языка НЕактивного редактора беджик не трогает.
        firstEditor.setLanguage("python");
        expect(statusBarController.view.getItems()).toContainEqual({ text: "plaintext", align: "right" });

        // Смена языка активного — обновляет.
        editorGroupController.getActiveEditor()!.setLanguage("json");
        expect(statusBarController.view.getItems()).toContainEqual({ text: "json", align: "right" });
    });
});
