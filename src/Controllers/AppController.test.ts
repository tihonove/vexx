import { describe, expect, it, vi } from "vitest";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { Container } from "../Common/DiContainer.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./StatusBarController.ts";

interface TestAppContext {
    testApp: TestApp;
    controller: AppController;
    commandRegistry: CommandRegistry;
}

function createTestAppController(size: Size = new Size(80, 24)): TestAppContext {
    // Build a DI container identical to production, but with MockTerminalBackend via TestApp
    const container = new Container();
    container
        .bind(CommandRegistryDIToken, () => new CommandRegistry())
        .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
        .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
        .bind(EditorGroupControllerDIToken, EditorGroupController)
        .bind(StatusBarControllerDIToken, StatusBarController)
        .bind(AppControllerDIToken, AppController);

    const controller = container.get(AppControllerDIToken);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);

    // Bind TuiApplicationDIToken for actions that need it (like quit)
    container.bind(TuiApplicationDIToken, () => testApp.app);

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
