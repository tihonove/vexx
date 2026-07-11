import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { createCursorSelection, createSelection } from "../Editor/ISelection.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface IntegrationContext {
    testApp: TestApp;
    controller: AppController;
}

function createIntegrationApp(tmpDir: string): IntegrationContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 40));
    bindApp(testApp.app);
    return { testApp, controller };
}

function openFocusedEditor(ctx: IntegrationContext, tmpDir: string, content: string): EditorElement {
    const file = path.join(tmpDir, "doc.txt");
    fs.writeFileSync(file, content);
    ctx.controller.openFile(file);
    ctx.controller.focusEditor();
    const editor = ctx.testApp.querySelector("EditorElement") as EditorElement;
    expect(editor).not.toBeNull();
    return editor;
}

describe("AppController — Tab / Shift+Tab indentation", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-indent-"));
        // A couple of sibling files so the workbench has a focusable tree to cycle to.
        for (let i = 0; i < 3; i++) {
            fs.writeFileSync(path.join(tmpDir, `sibling-${String(i)}.txt`), "x");
        }
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("Tab indents the focused editor", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        const ctx = { testApp, controller };
        const editor = openFocusedEditor(ctx, tmpDir, "hello");
        editor.viewState.selections = [createCursorSelection(0, 0)];

        testApp.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("\thello");
    });

    it("Tab keeps focus on the editor instead of cycling", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        const ctx = { testApp, controller };
        const editor = openFocusedEditor(ctx, tmpDir, "hello");

        testApp.sendKey("Tab");

        expect(testApp.focusedElement).toBe(editor);
    });

    it("Tab indents every line of a multi-line selection", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        const ctx = { testApp, controller };
        const editor = openFocusedEditor(ctx, tmpDir, "aa\nbb");
        editor.viewState.selections = [createSelection(0, 0, 1, 2)];

        testApp.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("\taa\n\tbb");
    });

    it("Shift+Tab outdents the focused editor", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        const ctx = { testApp, controller };
        const editor = openFocusedEditor(ctx, tmpDir, "\thello");
        editor.viewState.selections = [createCursorSelection(0, 3)];

        testApp.sendKey("Shift+Tab");

        expect(editor.viewState.document.getText()).toBe("hello");
    });

    it("Shift+Tab keeps focus on the editor instead of cycling", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        const ctx = { testApp, controller };
        const editor = openFocusedEditor(ctx, tmpDir, "\thello");

        testApp.sendKey("Shift+Tab");

        expect(testApp.focusedElement).toBe(editor);
    });
});
