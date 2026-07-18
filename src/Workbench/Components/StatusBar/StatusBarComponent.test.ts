import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStatusBarHarness } from "./StatusBarComponent.TestUtils.ts";

describe("StatusBarComponent", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        // Deterministic ambient environment so the terminal-env segment resolves to
        // a plain "legacy" tier with no non-local modes, regardless of the host
        // (e.g. running inside tmux/ssh would otherwise leak "ssh,tmux").
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

    it("view is a StatusBarElement with the statusBar id", () => {
        const { component } = createStatusBarHarness();
        expect(component.view).toBeDefined();
        expect(component.view.constructor.name).toBe("StatusBarElement");
        expect(component.view.id).toBe("statusBar");
    });

    it("shows only the terminal-environment segment when no file is open", () => {
        const { component } = createStatusBarHarness();

        // Test env has no probe → legacy tier, no non-local modes.
        expect(component.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("shows the cursor position (right-aligned) after a file is opened", () => {
        const { component, source } = createStatusBarHarness();

        source.openEditor();

        const items = component.view.getItems();
        expect(items).toEqual([
            { text: "legacy" },
            { text: "Ln 1, Col 1", align: "right" },
            { text: "UTF-8", align: "right", onClick: expect.any(Function) as () => void },
            { text: "LF", align: "right", onClick: expect.any(Function) as () => void },
            // NULL_LANGUAGE_SERVICE не знает display name — беджик показывает
            // сырой language id.
            { text: "plaintext", align: "right" },
        ]);
    });

    it("does not show the file name or a modified badge", () => {
        const { component, source } = createStatusBarHarness();

        const editor = source.openEditor();
        editor.viewState.type("x");

        const items = component.view.getItems();
        expect(items).not.toContainEqual({ text: "test-statusbar-nofile.txt" });
        expect(items).not.toContainEqual({ text: "[Modified]" });
    });

    it("omits the cursor position when there is no selection", () => {
        const { component, source } = createStatusBarHarness();

        const editor = source.openEditor();
        editor.viewState.selections = [];

        // Язык остаётся: активный редактор есть, пропадает только Ln/Col.
        expect(component.view.getItems()).toEqual([
            { text: "legacy" },
            { text: "UTF-8", align: "right", onClick: expect.any(Function) as () => void },
            { text: "LF", align: "right", onClick: expect.any(Function) as () => void },
            { text: "plaintext", align: "right" },
        ]);
    });

    it("shows the terminal tier as the first segment", () => {
        const { component } = createStatusBarHarness();
        expect(component.view.getItems()[0]).toEqual({ text: "legacy" });
    });

    it("updates the cursor column as text is typed", () => {
        const { component, source } = createStatusBarHarness();

        const editor = source.openEditor();
        editor.viewState.type("x");

        const items = component.view.getItems();
        expect(items).toContainEqual({ text: "Ln 1, Col 2", align: "right" });
    });

    it("shows the chord hint entry and clears it on dispose", () => {
        const { component, statusBarService } = createStatusBarHarness();

        // Chord-хинт публикует KeybindingDispatcher как обычную запись сервиса.
        const hint = statusBarService.addEntry({
            id: "status.chordHint",
            text: "(Ctrl+K) was pressed. Waiting for next key…",
            alignment: "left",
            priority: 50,
        });
        expect(component.view.getItems()).toContainEqual({
            text: "(Ctrl+K) was pressed. Waiting for next key…",
        });

        hint.dispose();
        expect(component.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("keeps the chord hint alongside the cursor position", () => {
        const { component, source, statusBarService } = createStatusBarHarness();
        source.openEditor();

        statusBarService.addEntry({
            id: "status.chordHint",
            text: "(Ctrl+K) waiting…",
            alignment: "left",
            priority: 50,
        });

        const items = component.view.getItems();
        expect(items).toContainEqual({ text: "(Ctrl+K) waiting…" });
        expect(items).toContainEqual({ text: "Ln 1, Col 1", align: "right" });
    });

    it("tracks the cursor live without an explicit refresh", () => {
        const { component, source } = createStatusBarHarness();

        const editor = source.openEditor();

        // No manual refresh — the cursor-change subscription drives the update.
        editor.viewState.type("abc");

        expect(component.view.getItems()).toContainEqual({ text: "Ln 1, Col 4", align: "right" });
    });

    it("dispose of the contributions removes their entries", () => {
        const { component, source, editorContribution, terminalContribution } = createStatusBarHarness();
        source.openEditor();

        editorContribution.dispose();
        expect(component.view.getItems()).toEqual([{ text: "legacy" }]);

        terminalContribution.dispose();
        expect(component.view.getItems()).toEqual([]);
    });

    it("dispose of the component stops following the service", () => {
        const { component, statusBarService } = createStatusBarHarness();

        component.dispose();
        statusBarService.addEntry({ id: "late", text: "late", alignment: "left", priority: 0 });

        expect(component.view.getItems()).toEqual([{ text: "legacy" }]);
    });
});
