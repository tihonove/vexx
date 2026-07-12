import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Point } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";

import type { AppController } from "./AppController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";

function createIntegrationWorkspace(): ITempWorkspace {
    return createTempWorkspace({
        prefix: "vexx-integration-",
        files: {
            "hello.txt": "hello world",
            "notes.md": "# Notes",
        },
    });
}

describe("FileTree opens file in editor", () => {
    let ws: ITempWorkspace;
    let testApp: IAppHarness["testApp"];
    let controller: AppController;

    beforeEach(async () => {
        ws = createIntegrationWorkspace();
        const h = createAppTestHarness({ workspaceFolder: ws.dir });
        testApp = h.testApp;
        controller = h.controller;
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        ws.dispose();
    });

    it("activating a file in the tree opens it in the editor", () => {
        const tree = testApp.querySelector("TreeViewElement");
        expect(tree).not.toBeNull();

        // Focus tree and navigate to a file, then press Enter
        tree!.focus();
        testApp.render();

        // First item is "hello.txt" (files sorted alphabetically; no directories here)
        testApp.sendKey("Enter");
        testApp.render();

        // File should now be open in the editor group
        const editorGroupCtrl = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroupCtrl.editorCount).toBe(1);
        expect(editorGroupCtrl.getActiveEditor()?.fileName).toBe("hello.txt");
    });

    it("activating a second file opens another tab", () => {
        const tree = testApp.querySelector("TreeViewElement");
        tree!.focus();
        testApp.render();

        // Activate first file — focus moves to editor
        testApp.sendKey("Enter");
        testApp.render();

        // Return focus to tree to navigate to second file
        tree!.focus();
        testApp.sendKey("ArrowDown");
        testApp.sendKey("Enter");
        testApp.render();

        const editorGroupCtrl = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroupCtrl.editorCount).toBe(2);
    });

    it("focus moves to editor after activating a file from the tree", () => {
        const tree = testApp.querySelector("TreeViewElement");
        tree!.focus();
        testApp.render();

        testApp.sendKey("Enter");
        testApp.render();

        const focused = testApp.focusedElement;
        expect(focused).not.toBeNull();
        expect(focused!.constructor.name).toBe("EditorElement");
    });

    it("does not call console.log when activating file", () => {
        const consoleSpy = vi.spyOn(console, "log");

        const tree = testApp.querySelector("TreeViewElement");
        tree!.focus();
        testApp.render();

        testApp.sendKey("Enter");

        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("does not insert characters into editor when opened with Enter", () => {
        const tree = testApp.querySelector("TreeViewElement");
        tree!.focus();
        testApp.render();

        testApp.sendKey("Enter");
        testApp.render();

        const editorGroupCtrl = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroupCtrl.getActiveEditor()?.getText()).toBe("hello world");
    });

    it("setFileDecorations pushes name colour + badge into the tree", async () => {
        const gitColor = packRgb(115, 201, 145);
        // notes.md is row 1 (hello.txt is the cursor on row 0), so its name takes the
        // decoration colour; "U" is a badge letter absent from the sidebar chrome.
        controller.setFileDecorations([{ path: ws.path("notes.md"), color: gitColor, badge: "U" }]);
        await new Promise((r) => setTimeout(r, 20));
        testApp.render();

        expect(testApp.backend.screenToString()).toContain("U");

        let coloured = false;
        const size = testApp.backend.getSize();
        for (let y = 0; y < size.height && !coloured; y++) {
            for (let x = 0; x < size.width; x++) {
                if (testApp.backend.getFgAt(new Point(x, y)) === gitColor) {
                    coloured = true;
                    break;
                }
            }
        }
        expect(coloured).toBe(true);
    });
});

describe("sidebar visibility commands", () => {
    let ws: ITempWorkspace;
    let testApp: IAppHarness["testApp"];
    let controller: AppController;
    let commands: IAppHarness["commands"];

    beforeEach(async () => {
        ws = createIntegrationWorkspace();
        const h = createAppTestHarness({ workspaceFolder: ws.dir });
        testApp = h.testApp;
        controller = h.controller;
        commands = h.commands;
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        ws.dispose();
    });

    it("Ctrl+B hides the left panel", () => {
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
        testApp.sendKey("Ctrl+B");
        testApp.render();
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(false);
    });

    it("Ctrl+B toggles back to visible", () => {
        testApp.sendKey("Ctrl+B");
        testApp.render();
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(false);

        testApp.sendKey("Ctrl+B");
        testApp.render();
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
    });

    it("Ctrl+Shift+E makes hidden panel visible", () => {
        controller.workbenchLayout.setLeftPanelVisible(false);
        controller.workbenchLayout.markDirty();
        testApp.render();

        commands.execute("workbench.view.explorer");
        testApp.render();

        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
    });

    it("Ctrl+Shift+E focuses the file tree", async () => {
        await controller.activate();
        testApp.render();

        commands.execute("workbench.view.explorer");
        testApp.render();

        const focused = testApp.focusedElement;
        expect(focused).not.toBeNull();
        expect(focused!.constructor.name).toBe("TreeViewElement");
    });
});
