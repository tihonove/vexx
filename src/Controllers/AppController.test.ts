import { describe, expect, it, vi } from "vitest";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { Container } from "../Common/DiContainer.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorController, EditorControllerDIToken } from "./EditorController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";

function createTestAppController(size: Size = new Size(80, 24)): { testApp: TestApp; controller: AppController } {
    // Build a DI container identical to production, but with MockTerminalBackend via TestApp
    const container = new Container();
    container
        .bind(CommandRegistryDIToken, () => new CommandRegistry())
        .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
        .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
        .bind(EditorControllerDIToken, EditorController)
        .bind(AppControllerDIToken, AppController);

    const controller = container.get(AppControllerDIToken);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);

    // Bind TuiApplicationDIToken for actions that need it (like quit)
    container.bind(TuiApplicationDIToken, () => testApp.app);

    return { testApp, controller };
}

describe("AppController integration", () => {
    it("creates UI tree with menubar and editor", () => {
        const { testApp } = createTestAppController();

        expect(testApp.querySelector("MenuBarElement")).not.toBeNull();
        expect(testApp.querySelector("ScrollContainerElement")).not.toBeNull();
    });

    it("focuses editor via focusEditor()", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("Ctrl+S executes save command", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        const commands = testApp.app["root"]!;
        const saveSpy = vi.fn();

        // Listen for save by intercepting keydown at body level
        const commandRegistry = new CommandRegistry();
        // Instead, spy on the EditorController.save via the DOM
        const editor = controller["editorController"];
        vi.spyOn(editor, "save").mockImplementation(saveSpy);

        testApp.sendKey("Ctrl+S");

        expect(saveSpy).toHaveBeenCalledTimes(1);
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
        controller.focusEditor();

        testApp.sendKey("h");
        testApp.sendKey("i");

        const editorController = controller["editorController"];
        expect(editorController.getText()).toBe("hi");
    });
});
