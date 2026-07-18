import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ILanguageService } from "../../../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../Editor/Tokenization/ILanguageService.ts";

import { createStatusBarHarness } from "./StatusBarComponent.TestUtils.ts";

describe("StatusBarComponent — language badge", () => {
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
        const { component } = createStatusBarHarness();
        expect(component.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("показывает display name из ILanguageService, беджик правее Ln/Col", () => {
        const languageService: ILanguageService = {
            ...NULL_LANGUAGE_SERVICE,
            getLanguageIdForResource: () => undefined,
            getLanguageDisplayName: (id) => (id === "typescript" ? "TypeScript" : undefined),
        };
        const { component, source } = createStatusBarHarness(languageService);

        const editor = source.openEditor();
        editor.setLanguage("typescript");

        expect(component.view.getItems()).toEqual([
            { text: "legacy" },
            { text: "Ln 1, Col 1", align: "right" },
            { text: "UTF-8", align: "right", onClick: expect.any(Function) as () => void },
            { text: "LF", align: "right", onClick: expect.any(Function) as () => void },
            { text: "TypeScript", align: "right" },
        ]);
    });

    it("откатывается на сырой language id без display name", () => {
        const { component, source } = createStatusBarHarness();

        source.openEditor();

        expect(component.view.getItems()).toContainEqual({ text: "plaintext", align: "right" });
    });

    it("обновляется на setLanguage без ручного обновления", () => {
        const { component, source } = createStatusBarHarness();
        const editor = source.openEditor();

        editor.setLanguage("markdown");

        expect(component.view.getItems()).toContainEqual({ text: "markdown", align: "right" });
    });

    it("переподписывается при смене активного редактора", () => {
        const { component, source } = createStatusBarHarness();
        const firstEditor = source.openEditor();
        source.openEditor();

        // Смена языка НЕактивного редактора беджик не трогает.
        firstEditor.setLanguage("python");
        expect(component.view.getItems()).toContainEqual({ text: "plaintext", align: "right" });

        // Смена языка активного — обновляет.
        source.getActiveEditor()!.setLanguage("json");
        expect(component.view.getItems()).toContainEqual({ text: "json", align: "right" });
    });
});
