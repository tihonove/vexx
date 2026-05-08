import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface TestContext {
    testApp: TestApp;
    controller: AppController;
    editor: EditorElement;
}

function createTestContext(content: string, tmpDir: string): TestContext {
    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(filePath, content, "utf-8");

    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.mount();

    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);

    controller.openFile(filePath);
    controller.focusEditor();

    const editor = testApp.querySelector("EditorElement") as EditorElement;
    return { testApp, controller, editor };
}

describe("AppController word selection (Ctrl+Shift+Arrow/Home/End)", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-word-sel-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ─── Ctrl+Shift+ArrowRight ──────────────────────────────

    it("Ctrl+Shift+ArrowRight selects first word from start", () => {
        const { testApp, editor } = createTestContext("hello world", tmpDir);

        testApp.sendKey("Ctrl+Shift+ArrowRight");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 6 });
    });

    it("Ctrl+Shift+ArrowRight twice selects both words", () => {
        const { testApp, editor } = createTestContext("hello world", tmpDir);

        testApp.sendKey("Ctrl+Shift+ArrowRight");
        testApp.sendKey("Ctrl+Shift+ArrowRight");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 11 });
    });

    // ─── Ctrl+Shift+ArrowLeft ───────────────────────────────

    it("Ctrl+Shift+ArrowLeft selects last word from end", () => {
        const { testApp, editor } = createTestContext("hello world", tmpDir);

        testApp.sendKey("End");
        testApp.sendKey("Ctrl+Shift+ArrowLeft");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 0, character: 11 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 6 });
    });

    it("Ctrl+Shift+ArrowLeft twice selects both words from end", () => {
        const { testApp, editor } = createTestContext("hello world", tmpDir);

        testApp.sendKey("End");
        testApp.sendKey("Ctrl+Shift+ArrowLeft");
        testApp.sendKey("Ctrl+Shift+ArrowLeft");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 0, character: 11 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    // ─── Ctrl+Shift+Home ────────────────────────────────────

    it("Ctrl+Shift+Home selects from cursor to document start", () => {
        const { testApp, editor } = createTestContext("hello\nworld", tmpDir);

        testApp.sendKey("ArrowDown");
        testApp.sendKey("End");
        testApp.sendKey("Ctrl+Shift+Home");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 1, character: 5 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    // ─── Ctrl+Shift+End ─────────────────────────────────────

    it("Ctrl+Shift+End selects from cursor to document end", () => {
        const { testApp, editor } = createTestContext("hello\nworld", tmpDir);

        testApp.sendKey("Ctrl+Shift+End");

        expect(editor.viewState.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(editor.viewState.selections[0].active).toEqual({ line: 1, character: 5 });
    });
});
