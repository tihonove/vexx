import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { ConfirmSaveDialogElement } from "../TUIDom/Widgets/ConfirmSaveDialogElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { ServiceAccessorDIToken } from "./CoreTokens.ts";
import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface TestQuitContext {
    testApp: TestApp;
    controller: AppController;
    accessor: ServiceAccessor;
}

function createTestContext(): TestQuitContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);
    const accessor = container.get(ServiceAccessorDIToken);
    return { testApp, controller, accessor };
}

describe("AppController quit with save dialog", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("quits immediately when no unsaved files", () => {
        const { controller, accessor } = createTestContext();

        controller.requestQuit(accessor);

        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("shows confirm dialog when there is an unsaved file", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-test-show.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement");
        expect(dialog).not.toBeNull();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("aborts quit when Cancel is pressed", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-test-cancel.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onCancel?.();

        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("quits without saving when Don't Save is pressed", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-test-dontsave.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onDontSave?.();

        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("saves file and quits when Save is pressed", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-test-save.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onSave?.();

        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("shows dialog for each unsaved file sequentially", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-seq-a.txt");
        controller.focusEditor();
        testApp.sendKey("x");
        controller.openFile("/tmp/quit-seq-b.txt");
        controller.focusEditor();
        testApp.sendKey("y");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        expect(exitSpy).not.toHaveBeenCalled();

        // Don't Save on first file
        dialog.onDontSave?.();
        expect(exitSpy).not.toHaveBeenCalled();

        // Don't Save on second file → quit
        dialog.onDontSave?.();
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("cancelling first dialog in sequence aborts quit entirely", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-seq-cancel-a.txt");
        controller.focusEditor();
        testApp.sendKey("x");
        controller.openFile("/tmp/quit-seq-cancel-b.txt");
        controller.focusEditor();
        testApp.sendKey("y");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onCancel?.();

        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("Ctrl+Q triggers quit flow and shows dialog for unsaved file", () => {
        const { testApp, controller } = createTestContext();
        controller.openFile("/tmp/quit-keybinding.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        testApp.sendKey("Ctrl+Q");

        expect(exitSpy).not.toHaveBeenCalled();
        expect(testApp.querySelector("ConfirmSaveDialogElement")).not.toBeNull();
    });

    it("Ctrl+Q quits immediately when no unsaved files", () => {
        const { testApp } = createTestContext();

        testApp.sendKey("Ctrl+Q");

        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});
