import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import type { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

const TOGGLE_SIDEBAR = "workbench.action.toggleSidebarVisibility";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-modalkbd-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
    return dir;
}

function createApp(tmpDir: string, size = new Size(80, 24)) {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken) };
}

/** Walk up the parent chain to confirm `el` lives inside `ancestor`. */
function isDescendantOf(el: TUIElement | null, ancestor: TUIElement): boolean {
    let cur = el;
    while (cur) {
        if (cur === ancestor) return true;
        cur = cur.getParent();
    }
    return false;
}

describe("AppController — global keybindings are suppressed while an overlay owns the keyboard", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(async () => {
        tmpDir = createTempWorkspace();
        ({ testApp, controller, commands } = createApp(tmpDir));
        await controller.activate();
        await controller.fileIndexReady;
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it("quickpick swallows Ctrl+B: sidebar does not toggle, focus stays, overlay stays up", () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        expect(picker).toBeTruthy();
        expect(testApp.focusedElement).toBe(picker.inputElement);

        const before = controller.workbenchLayout.getLeftPanelVisible();
        const executeSpy = vi.spyOn(commands, "execute");

        testApp.sendKey("Ctrl+B");
        testApp.render();

        expect(executeSpy).not.toHaveBeenCalledWith(TOGGLE_SIDEBAR);
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(before); // global did NOT fire
        expect(testApp.focusedElement).toBe(picker.inputElement); // focus stayed in the picker
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true); // overlay not orphaned
    });

    it("typing still reaches the quickpick input while it owns the keyboard", () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        expect(picker).toBeTruthy();

        testApp.sendKey("a");
        testApp.sendKey("l");
        testApp.render();

        expect(picker.getQuery()).toBe("al");
    });

    it("focus-scoped editing works in the quickpick while workbench shortcuts stay suppressed", () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        testApp.sendKey("h");
        testApp.sendKey("i");

        // Ctrl+A (when: inputWidgetFocus) is focus-scoped → it edits the query…
        testApp.sendKey("Ctrl+A");
        testApp.render();
        expect(picker.inputElement.inputState.selectedText).toBe("hi");

        // …but Ctrl+B (a workbench command, no focus-scoped when) is still swallowed.
        const before = controller.workbenchLayout.getLeftPanelVisible();
        testApp.sendKey("Ctrl+B");
        testApp.render();
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(before);
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("a chord prefix does not start a chord while the quickpick owns the keyboard", () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        expect(picker).toBeTruthy();

        // Ctrl+K is the prefix of the GLOBAL "Ctrl+K S → save" chord (no when), so it would
        // start a chord anywhere. While the quickpick owns the keyboard it must not: the pending
        // chord is reset, so the next key still types into the query instead of being swallowed
        // as a (broken) chord continuation.
        testApp.sendKey("Ctrl+K");
        testApp.sendKey("z");
        testApp.render();

        expect(picker.getQuery()).toBe("z");
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("the quickpick's own keys still work (ArrowDown moves selection, Escape closes)", () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        expect(picker.items.length).toBeGreaterThan(1);
        expect(picker.selectedIndex).toBe(0);

        testApp.sendKey("ArrowDown");
        testApp.render();
        expect(picker.selectedIndex).toBe(1);

        testApp.sendKey("Escape");
        testApp.render();
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("a modal confirm dialog swallows Ctrl+B", () => {
        controller.showConfirmSaveDialog("alpha.txt", {
            onSave: () => {},
            onDontSave: () => {},
            onCancel: () => {},
        });
        testApp.render();

        const dialog = testApp.querySelector("ConfirmSaveDialogElement");
        expect(dialog).toBeTruthy();
        expect(isDescendantOf(testApp.focusedElement, dialog!)).toBe(true);

        const before = controller.workbenchLayout.getLeftPanelVisible();
        const executeSpy = vi.spyOn(commands, "execute");

        testApp.sendKey("Ctrl+B");
        testApp.render();

        expect(executeSpy).not.toHaveBeenCalledWith(TOGGLE_SIDEBAR);
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(before);
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true); // dialog still up
    });

    it("a passthrough overlay (Find) does NOT suppress globals — Ctrl+B still toggles the sidebar", () => {
        commands.execute("workbench.openFile", path.join(tmpDir, "alpha.txt"));
        testApp.render();

        commands.execute("actions.find");
        testApp.render();

        const findWidget = testApp.querySelector("FindWidgetElement");
        expect(findWidget).toBeTruthy();
        // Find genuinely opened and owns focus, so the scenario is real.
        expect(isDescendantOf(testApp.focusedElement, findWidget!)).toBe(true);

        const before = controller.workbenchLayout.getLeftPanelVisible();
        testApp.sendKey("Ctrl+B");
        testApp.render();

        // Find lives in the editor-group overlay layer and is passthrough, so the body
        // dispatcher's gate ignores it: the global shortcut fires as usual.
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(!before);
    });
});
