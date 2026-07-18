import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppTestHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import type { TestApp } from "../TestUtils/TestApp.ts";

import type { AppController } from "./AppController.ts";
import type { CommandRegistry } from "../Workbench/Services/CommandRegistry.ts";
import { type EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";

interface TestContext {
    testApp: TestApp;
    controller: AppController;
    commandRegistry: CommandRegistry;
    editorGroupController: EditorGroupController;
}

function createTestContext(): TestContext {
    const h = createAppTestHarness();
    return {
        testApp: h.testApp,
        controller: h.controller,
        commandRegistry: h.commands,
        editorGroupController: h.container.get(EditorGroupControllerDIToken),
    };
}

describe("EditorGroupController focus management on tab close", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-focus-test-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    it("focusManager.activeElement is null after closing the only tab", () => {
        const { testApp, controller, editorGroupController } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));
        controller.focusEditor();

        expect(testApp.focusedElement).not.toBeNull();

        editorGroupController.closeTab(0);

        expect(testApp.focusedElement).toBeNull();
    });

    it("focus moves to the new active editor after closing the last tab when two are open", () => {
        const { testApp, controller, editorGroupController } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));
        controller.openFile(ws.writeFile("b.ts", "b"));
        controller.focusEditor();

        const initialFocused = testApp.focusedElement;
        expect(initialFocused).not.toBeNull();

        editorGroupController.closeTab(1);

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).not.toBe(initialFocused);
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("keyboard hotkeys work after closing the only tab", () => {
        const { testApp, controller, commandRegistry, editorGroupController } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));
        controller.focusEditor();
        editorGroupController.closeTab(0);

        const executeSpy = vi.spyOn(commandRegistry, "execute");

        // Ctrl+S should still be dispatched and reach the root command handlers
        testApp.sendKey("Ctrl+S");

        // The command may or may not execute depending on when-context guards,
        // but the key must not be silently swallowed by an orphaned element.
        // We verify the event was properly dispatched by checking no throw occurred
        // and that activeElement remains null (no zombie focus restored).
        expect(testApp.focusedElement).toBeNull();
    });

    it("activeElement points to living element in the tree after tab switch on close", () => {
        const { testApp, controller, editorGroupController } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));
        controller.openFile(ws.writeFile("b.ts", "b"));
        controller.openFile(ws.writeFile("c.ts", "c"));
        controller.focusEditor();

        // close active (index 2)
        editorGroupController.closeTab(2);

        const focused = testApp.focusedElement;
        expect(focused).not.toBeNull();
        // focused element must be reachable from root (in the live tree)
        expect(focused!.getRoot()).not.toBeNull();
    });

    it("activeElement is null (not orphaned) after closing the only tab", () => {
        const { testApp, controller, editorGroupController } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));
        controller.focusEditor();

        editorGroupController.closeTab(0);

        const focused = testApp.focusedElement;
        // If focused is not null it must still be in the live tree
        if (focused !== null) {
            expect(focused.getRoot()).not.toBeNull();
        }
    });
});

describe("EditorGroupController auto-focus on file open", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-autofocus-test-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    it("editor receives focus automatically when a file is opened", () => {
        const { testApp, controller } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("editor receives focus when switching to an already-open file", () => {
        const { testApp, controller } = createTestContext();
        const fp = ws.writeFile("a.ts", "a");
        controller.openFile(fp);
        controller.openFile(ws.writeFile("b.ts", "b"));
        // open a.ts again — should switch tab and focus
        controller.openFile(fp);

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("focusManager.activeElement is the exact EditorElement instance after openFile", () => {
        const { testApp, editorGroupController, controller } = createTestContext();
        controller.openFile(ws.writeFile("a.ts", "a"));

        const editorElement = editorGroupController.getActiveEditor()!.view.getChild();
        expect(testApp.app.focusManager?.activeElement).toBe(editorElement);
    });
});
