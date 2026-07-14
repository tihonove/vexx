import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EditorElement } from "../../../../editor/tui/editorElement.ts";

import { EditorGroupController, EditorGroupControllerDIToken } from "../editor/editorGroupController.ts";
import { createTestContainer } from "../../../../vexx/modules/testProfile.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./statusBarController.ts";

function createStatusBarController(): {
    statusBarController: StatusBarController;
    editorGroupController: EditorGroupController;
} {
    const { container } = createTestContainer();

    const editorGroupController = container.get(EditorGroupControllerDIToken);
    const statusBarController = container.get(StatusBarControllerDIToken);

    editorGroupController.mount();

    return { statusBarController, editorGroupController };
}

describe("StatusBarController", () => {
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

    it("view is a StatusBarElement", () => {
        const { statusBarController } = createStatusBarController();
        expect(statusBarController.view).toBeDefined();
        expect(statusBarController.view.constructor.name).toBe("StatusBarElement");
    });

    it("shows only the terminal-environment segment when no file is open", () => {
        const { statusBarController } = createStatusBarController();
        statusBarController.mount();

        // Test env has no probe → legacy tier, no non-local modes.
        expect(statusBarController.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("shows the cursor position (right-aligned) after a file is opened", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-file.txt");
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toEqual([
            { text: "legacy" },
            { text: "Ln 1, Col 1", align: "right" },
            // NULL_LANGUAGE_SERVICE в TestProfile не знает display name — беджик
            // показывает сырой language id.
            { text: "plaintext", align: "right" },
        ]);
    });

    it("does not show the file name or a modified badge", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-nofile.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        const editorElement = activeEditor.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).not.toContainEqual({ text: "test-statusbar-nofile.txt" });
        expect(items).not.toContainEqual({ text: "[Modified]" });
    });

    it("omits the cursor position when there is no selection", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();
        editorGroupController.openFile("/tmp/test-statusbar-nosel.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        activeEditor.viewState.selections = [];
        statusBarController.update();

        // Язык остаётся: активный редактор есть, пропадает только Ln/Col.
        expect(statusBarController.view.getItems()).toEqual([
            { text: "legacy" },
            { text: "plaintext", align: "right" },
        ]);
    });

    it("shows the terminal tier as the first segment", () => {
        const { statusBarController } = createStatusBarController();
        statusBarController.mount();
        expect(statusBarController.view.getItems()[0]).toEqual({ text: "legacy" });
    });

    it("updates the cursor column as text is typed", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-mod.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        const editorElement = activeEditor.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");

        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toContainEqual({ text: "Ln 1, Col 2", align: "right" });
    });

    it("shows the chord hint and clears it with null", () => {
        const { statusBarController } = createStatusBarController();
        statusBarController.mount();

        statusBarController.setChordHint("(Ctrl+K) was pressed. Waiting for next key…");
        expect(statusBarController.view.getItems()).toContainEqual({
            text: "(Ctrl+K) was pressed. Waiting for next key…",
        });

        statusBarController.setChordHint(null);
        expect(statusBarController.view.getItems()).toEqual([{ text: "legacy" }]);
    });

    it("keeps the chord hint alongside the cursor position", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();
        editorGroupController.openFile("/tmp/test-statusbar-chord.txt");

        statusBarController.setChordHint("(Ctrl+K) waiting…");

        const items = statusBarController.view.getItems();
        expect(items).toContainEqual({ text: "(Ctrl+K) waiting…" });
        expect(items).toContainEqual({ text: "Ln 1, Col 1", align: "right" });
    });

    it("tracks the cursor live without an explicit update() call", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-live.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        const editorElement = activeEditor.view.querySelector("EditorElement") as EditorElement;

        // No manual statusBarController.update() — the cursor-change subscription drives it.
        editorElement.viewState.type("abc");

        expect(statusBarController.view.getItems()).toContainEqual({ text: "Ln 1, Col 4", align: "right" });
    });
});
