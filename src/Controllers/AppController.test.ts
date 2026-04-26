import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface TestAppContext {
    testApp: TestApp;
    controller: AppController;
    commandRegistry: CommandRegistry;
}

function createTestAppController(size: Size = new Size(80, 24)): TestAppContext {
    const { container, bindApp } = createTestContainer();

    const controller = container.get(AppControllerDIToken);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);

    const commandRegistry = container.get(CommandRegistryDIToken);

    return { testApp, controller, commandRegistry };
}

describe("AppController integration", () => {
    it("creates UI tree with menubar and editor", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-tree.txt");

        expect(testApp.querySelector("MenuBarElement")).not.toBeNull();
        expect(testApp.querySelector("ScrollBarDecorator")).not.toBeNull();
    });

    it("focuses editor via focusEditor()", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-focus.txt");
        controller.focusEditor();

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("Ctrl+S executes save command", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.focusEditor();

        const executeSpy = vi.spyOn(commandRegistry, "execute");

        testApp.sendKey("Ctrl+S");

        expect(executeSpy).toHaveBeenCalledWith("workbench.action.files.save");
    });

    it("Tab cycles focus from editor to menubar", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        const editorElement = testApp.querySelector("EditorElement");
        const menuBar = testApp.querySelector("MenuBarElement");

        expect(testApp.focusedElement).toBe(editorElement);

        testApp.sendKey("Tab");

        expect(testApp.focusedElement).toBe(menuBar);
    });

    it("typing inserts text into editor", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-typing.txt");
        controller.focusEditor();

        testApp.sendKey("h");
        testApp.sendKey("i");

        const editorElement = testApp.querySelector("EditorElement") as EditorElement;
        expect(editorElement.viewState.document.getText()).toBe("hi");
    });

    it("Ctrl+Tab switches to next editor tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        testApp.sendKey("Ctrl+Tab");

        expect(tabStrip.activeIndex).toBe(0);
    });

    it("Ctrl+Tab keeps focus on EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+Tab");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("Ctrl+Shift+Tab switches to previous editor tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        testApp.sendKey("Ctrl+Shift+Tab");

        expect(tabStrip.activeIndex).toBe(0);
    });

    it("Ctrl+Shift+Tab keeps focus on EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+Shift+Tab");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("Ctrl+W closes active tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.getItemElements()).toHaveLength(2);

        testApp.sendKey("Ctrl+W");

        expect(tabStrip.getItemElements()).toHaveLength(1);
    });

    it("Ctrl+W keeps focus on remaining EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+W");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("creates UI tree with statusbar", () => {
        const { testApp } = createTestAppController();

        expect(testApp.querySelector("StatusBarElement")).not.toBeNull();
    });

    it("statusbar shows file name after openFile", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-app-statusbar.txt");

        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        const items = statusBar.getItems();
        expect(items).toContainEqual({ text: "test-app-statusbar.txt" });
    });

    it("statusbar shows [Modified] after typing", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-app-modified.txt");
        controller.focusEditor();

        testApp.sendKey("x");

        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        const items = statusBar.getItems();
        expect(items).toContainEqual({ text: "test-app-modified.txt" });
        expect(items).toContainEqual({ text: "[Modified]" });
    });
});
