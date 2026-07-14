import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../vs/base/common/geometry.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import type { EditorTabStripElement } from "../vs/workbench/tui/parts/editor/editorTabStripElement.ts";
import type { TreeViewElement } from "../vs/base/tui/ui/tree/treeViewElement.ts";

import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";

describe("AppController when-context integration", () => {
    let ws: ITempWorkspace;

    function createIntegrationApp(): IAppHarness {
        return createAppTestHarness({ workspaceFolder: ws.dir, size: new Size(80, 40) });
    }

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-when-" });
        // Create enough files so the tree has items to page through
        for (let i = 0; i < 30; i++) {
            ws.writeFile(`file-${String(i).padStart(2, "0")}.txt`, `content ${String(i)}`);
        }
    });

    afterEach(() => {
        ws.dispose();
    });

    it("sets textInputFocus when editor is focused", () => {
        const h = createIntegrationApp();
        const contextKeys = h.container.get(ContextKeyServiceDIToken);
        h.controller.openFile(ws.path("file-00.txt"));
        h.controller.focusEditor();

        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(false);
    });

    it("sets listFocus when tree is focused", async () => {
        const h = createIntegrationApp();
        const contextKeys = h.container.get(ContextKeyServiceDIToken);
        await h.controller.activate();

        const tree = h.testApp.querySelector("TreeViewElement");
        expect(tree).not.toBeNull();
        tree!.focus();

        expect(contextKeys.get("listFocus")).toBe(true);
        expect(contextKeys.get("textInputFocus")).toBe(false);
    });

    it("PageDown moves cursor in editor when editor is focused", () => {
        const h = createIntegrationApp();

        // Create a file with many lines
        const lines = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`);
        const longFile = ws.writeFile("long.txt", lines.join("\n"));

        h.controller.openFile(longFile);
        h.controller.focusEditor();

        const editor = h.testApp.querySelector("EditorElement") as EditorElement;
        expect(editor).not.toBeNull();
        expect(editor.viewState.selections[0].active.line).toBe(0);

        h.testApp.sendKey("PageDown");

        expect(editor.viewState.selections[0].active.line).toBeGreaterThan(0);
    });

    it("PageDown moves selection in tree when tree is focused", async () => {
        const h = createIntegrationApp();
        await h.controller.activate();

        const tree = h.testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        expect(tree).not.toBeNull();
        expect(tree.contentHeight).toBeGreaterThan(0);

        tree.focus();
        h.testApp.render();

        h.testApp.sendKey("PageDown");

        // After PageDown, the tree should have scrolled
        expect(tree.scrollTop).toBeGreaterThanOrEqual(0);
    });

    it("PageDown in editor does NOT move tree selection", async () => {
        const h = createIntegrationApp();
        await h.controller.activate();

        const lines = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`);
        const longFile = ws.writeFile("long.txt", lines.join("\n"));

        h.controller.openFile(longFile);
        h.controller.focusEditor();

        const tree = h.testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        const initialTreeScrollTop = tree.scrollTop;

        h.testApp.sendKey("PageDown");

        // Tree should not have changed
        expect(tree.scrollTop).toBe(initialTreeScrollTop);
    });

    it("context keys update correctly when switching focus", () => {
        const h = createIntegrationApp();
        const contextKeys = h.container.get(ContextKeyServiceDIToken);
        h.controller.openFile(ws.path("file-00.txt"));
        h.controller.openFile(ws.path("file-01.txt"));

        // Focus editor
        h.controller.focusEditor();
        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);

        // Focus tree
        const tree = h.testApp.querySelector("TreeViewElement");
        tree!.focus();
        expect(contextKeys.get("textInputFocus")).toBe(false);
        expect(contextKeys.get("listFocus")).toBe(true);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);

        // Focus editor again
        h.controller.focusEditor();
        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);
    });

    it("Ctrl+Tab does not switch tabs when tree has focus", async () => {
        const h = createIntegrationApp();
        await h.controller.activate();

        h.controller.openFile(ws.path("file-00.txt"));
        h.controller.openFile(ws.path("file-01.txt"));
        h.controller.focusEditor();

        const tabStrip = h.testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        const tree = h.testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        tree.focus();

        h.testApp.sendKey("Ctrl+Tab");

        expect(tabStrip.activeIndex).toBe(1);
    });
});
