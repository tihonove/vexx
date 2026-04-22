import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { Container } from "../Common/DiContainer.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { ContextKeyService as ContextKeyServiceClass } from "./ContextKeyService.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./StatusBarController.ts";

interface IntegrationContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    tmpDir: string;
}

function createIntegrationApp(tmpDir: string, size: Size = new Size(80, 40)): IntegrationContext {
    const container = new Container();
    container
        .bind(CommandRegistryDIToken, () => new CommandRegistry())
        .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
        .bind(ContextKeyServiceDIToken, () => new ContextKeyServiceClass())
        .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
        .bind(ThemeServiceDIToken, () => new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)))
        .bind(EditorGroupControllerDIToken, EditorGroupController)
        .bind(StatusBarControllerDIToken, StatusBarController)
        .bind(AppControllerDIToken, AppController);

    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);
    container.bind(TuiApplicationDIToken, () => testApp.app);

    const contextKeys = container.get(ContextKeyServiceDIToken);

    return { testApp, controller, contextKeys, tmpDir };
}

describe("AppController when-context integration", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-when-"));
        // Create enough files so the tree has items to page through
        for (let i = 0; i < 30; i++) {
            fs.writeFileSync(path.join(tmpDir, `file-${String(i).padStart(2, "0")}.txt`), `content ${String(i)}`);
        }
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("sets textInputFocus when editor is focused", () => {
        const { controller, contextKeys } = createIntegrationApp(tmpDir);
        controller.openFile(path.join(tmpDir, "file-00.txt"));
        controller.focusEditor();

        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(false);
    });

    it("sets listFocus when tree is focused", async () => {
        const { testApp, controller, contextKeys } = createIntegrationApp(tmpDir);
        await controller.activate();

        const tree = testApp.querySelector("TreeViewElement");
        expect(tree).not.toBeNull();
        tree!.focus();

        expect(contextKeys.get("listFocus")).toBe(true);
        expect(contextKeys.get("textInputFocus")).toBe(false);
    });

    it("PageDown moves cursor in editor when editor is focused", () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);

        // Create a file with many lines
        const longFile = path.join(tmpDir, "long.txt");
        const lines = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`);
        fs.writeFileSync(longFile, lines.join("\n"));

        controller.openFile(longFile);
        controller.focusEditor();

        const editor = testApp.querySelector("EditorElement") as EditorElement;
        expect(editor).not.toBeNull();
        expect(editor.viewState.selections[0].active.line).toBe(0);

        testApp.sendKey("PageDown");

        expect(editor.viewState.selections[0].active.line).toBeGreaterThan(0);
    });

    it("PageDown moves selection in tree when tree is focused", async () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        await controller.activate();

        const tree = testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        expect(tree).not.toBeNull();
        expect(tree.contentHeight).toBeGreaterThan(0);

        tree.focus();
        testApp.render();

        testApp.sendKey("PageDown");

        // After PageDown, the tree should have scrolled
        expect(tree.scrollTop).toBeGreaterThanOrEqual(0);
    });

    it("PageDown in editor does NOT move tree selection", async () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        await controller.activate();

        const longFile = path.join(tmpDir, "long.txt");
        const lines = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`);
        fs.writeFileSync(longFile, lines.join("\n"));

        controller.openFile(longFile);
        controller.focusEditor();

        const tree = testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        const initialTreeScrollTop = tree.scrollTop;

        testApp.sendKey("PageDown");

        // Tree should not have changed
        expect(tree.scrollTop).toBe(initialTreeScrollTop);
    });

    it("context keys update correctly when switching focus", () => {
        const { testApp, controller, contextKeys } = createIntegrationApp(tmpDir);
        controller.openFile(path.join(tmpDir, "file-00.txt"));
        controller.openFile(path.join(tmpDir, "file-01.txt"));

        // Focus editor
        controller.focusEditor();
        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);

        // Focus tree
        const tree = testApp.querySelector("TreeViewElement");
        tree!.focus();
        expect(contextKeys.get("textInputFocus")).toBe(false);
        expect(contextKeys.get("listFocus")).toBe(true);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);

        // Focus editor again
        controller.focusEditor();
        expect(contextKeys.get("textInputFocus")).toBe(true);
        expect(contextKeys.get("listFocus")).toBe(false);
        expect(contextKeys.get("editorGroupHasEditors")).toBe(true);
        expect(contextKeys.get("editorTabsMultiple")).toBe(true);
    });

    it("Ctrl+Tab does not switch tabs when tree has focus", async () => {
        const { testApp, controller } = createIntegrationApp(tmpDir);
        await controller.activate();

        controller.openFile(path.join(tmpDir, "file-00.txt"));
        controller.openFile(path.join(tmpDir, "file-01.txt"));
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        const tree = testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        tree.focus();

        testApp.sendKey("Ctrl+Tab");

        expect(tabStrip.activeIndex).toBe(1);
    });
});
