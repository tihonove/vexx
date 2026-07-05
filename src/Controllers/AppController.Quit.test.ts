import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { ConfirmSaveDialogElement } from "../TUIDom/Widgets/ConfirmSaveDialogElement.tsx";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { ServiceAccessorDIToken } from "./CoreTokens.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";
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

/** Save теперь async — сохранение и последующий quit/close откладываются на
 *  микротаск, поэтому Save-ветки диалога надо «прокрутить» перед проверкой. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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

    it("saves file and quits when Save is pressed", async () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-test-save.txt");
        controller.focusEditor();
        testApp.sendKey("x");

        controller.requestQuit(accessor);

        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onSave?.();
        await tick();

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

    it("Save on the first dialog proceeds to the next file's dialog before quitting", async () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-seq-save-a.txt");
        controller.focusEditor();
        testApp.sendKey("x");
        controller.openFile("/tmp/quit-seq-save-b.txt");
        controller.focusEditor();
        testApp.sendKey("y");

        controller.requestQuit(accessor);

        // First dialog: Save → saves file, advances to second dialog (no quit yet).
        const firstDialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        firstDialog.onSave?.();
        await tick();
        expect(exitSpy).not.toHaveBeenCalled();

        // A second dialog is shown for the remaining unsaved file.
        const secondDialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        expect(secondDialog).not.toBeNull();

        // Save on the last file → quit.
        secondDialog.onSave?.();
        await tick();
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("skips indices whose editor vanished mid-sequence and still quits", () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-seq-stale-a.txt");
        controller.focusEditor();
        testApp.sendKey("x");
        controller.openFile("/tmp/quit-seq-stale-b.txt");
        controller.focusEditor();
        testApp.sendKey("y");
        controller.openFile("/tmp/quit-seq-stale-c.txt");
        controller.focusEditor();
        testApp.sendKey("z");

        // requestQuit snapshots the modified indices [0, 1, 2] and shows the dialog for index 0.
        controller.requestQuit(accessor);
        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        expect(exitSpy).not.toHaveBeenCalled();

        // Tabs 1 and 2 disappear before we answer, so their snapshotted indices are now stale.
        const editorGroup = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        editorGroup.closeTab(2);
        editorGroup.closeTab(1);

        // Advancing the sequence walks past the now-missing editors and quits at the end.
        dialog.onDontSave?.();
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("mixes Save then Don't Save across the sequence and quits at the end", async () => {
        const { testApp, controller, accessor } = createTestContext();
        controller.openFile("/tmp/quit-seq-mix-a.txt");
        controller.focusEditor();
        testApp.sendKey("x");
        controller.openFile("/tmp/quit-seq-mix-b.txt");
        controller.focusEditor();
        testApp.sendKey("y");

        controller.requestQuit(accessor);

        const first = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        first.onSave?.();
        await tick();
        expect(exitSpy).not.toHaveBeenCalled();

        const second = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        second.onDontSave?.();
        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});

describe("AppController close-tab confirm flow", () => {
    it("closing a modified tab shows the confirm dialog (no immediate close)", () => {
        const { testApp, controller } = createTestContext();
        controller.openFile("/tmp/close-confirm-a.txt");
        controller.openFile("/tmp/close-confirm-b.txt");
        controller.focusEditor();
        testApp.sendKey("z"); // modify the active tab

        testApp.sendKey("Ctrl+W");

        expect(testApp.querySelector("ConfirmSaveDialogElement")).not.toBeNull();
        // Both tabs still present — close was deferred to the dialog.
        const tabStrip = testApp.querySelector("EditorTabStripElement");
        expect(tabStrip).not.toBeNull();
    });

    it("Don't Save on the close-tab dialog closes the tab", () => {
        const { testApp, controller } = createTestContext();
        controller.openFile("/tmp/close-confirm-c.txt");
        controller.openFile("/tmp/close-confirm-d.txt");
        controller.focusEditor();
        testApp.sendKey("z");

        const tabStrip = testApp.querySelector("EditorTabStripElement") as unknown as {
            getItemElements: () => readonly unknown[];
        };
        expect(tabStrip.getItemElements()).toHaveLength(2);

        testApp.sendKey("Ctrl+W");
        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onDontSave?.();
        testApp.render();

        expect(tabStrip.getItemElements()).toHaveLength(1);
    });

    it("Save on the close-tab dialog saves and closes the tab", async () => {
        const { testApp, controller } = createTestContext();
        controller.openFile("/tmp/close-confirm-e.txt");
        controller.openFile("/tmp/close-confirm-f.txt");
        controller.focusEditor();
        testApp.sendKey("z");

        const tabStrip = testApp.querySelector("EditorTabStripElement") as unknown as {
            getItemElements: () => readonly unknown[];
        };

        testApp.sendKey("Ctrl+W");
        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onSave?.();
        await tick();
        testApp.render();

        expect(tabStrip.getItemElements()).toHaveLength(1);
    });

    it("Cancel on the close-tab dialog keeps the tab open", () => {
        const { testApp, controller } = createTestContext();
        controller.openFile("/tmp/close-confirm-g.txt");
        controller.openFile("/tmp/close-confirm-h.txt");
        controller.focusEditor();
        testApp.sendKey("z");

        const tabStrip = testApp.querySelector("EditorTabStripElement") as unknown as {
            getItemElements: () => readonly unknown[];
        };

        testApp.sendKey("Ctrl+W");
        const dialog = testApp.querySelector("ConfirmSaveDialogElement") as ConfirmSaveDialogElement;
        dialog.onCancel?.();
        testApp.render();

        expect(tabStrip.getItemElements()).toHaveLength(2);
    });
});
