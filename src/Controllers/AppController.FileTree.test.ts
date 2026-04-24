import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { Container } from "../Common/DiContainer.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import {
    ServiceAccessorDIToken,
    TokenizationRegistryDIToken,
    TokenStyleResolverDIToken,
    TuiApplicationDIToken,
} from "./CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./StatusBarController.ts";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-integration-"));
    fs.writeFileSync(path.join(dir, "hello.txt"), "hello world");
    fs.writeFileSync(path.join(dir, "notes.md"), "# Notes");
    return dir;
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

interface IntegrationContext {
    testApp: TestApp;
    controller: AppController;
    tmpDir: string;
}

function createIntegrationApp(tmpDir: string, size: Size = new Size(80, 24)): IntegrationContext {
    const container = new Container();
    container
        .bind(CommandRegistryDIToken, () => new CommandRegistry())
        .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
        .bind(ContextKeyServiceDIToken, () => new ContextKeyService())
        .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
        .bind(ThemeServiceDIToken, () => new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)))
        .bind(TokenizationRegistryDIToken, () => new TokenizationRegistry())
        .bind(TokenStyleResolverDIToken, () => NULL_TOKEN_STYLE_RESOLVER)
        .bind(EditorGroupControllerDIToken, EditorGroupController)
        .bind(StatusBarControllerDIToken, StatusBarController)
        .bind(AppControllerDIToken, AppController);

    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);
    container.bind(TuiApplicationDIToken, () => testApp.app);

    return { testApp, controller, tmpDir };
}

describe("FileTree opens file in editor", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        tmpDir = createTempWorkspace();
        const ctx = createIntegrationApp(tmpDir);
        testApp = ctx.testApp;
        controller = ctx.controller;
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
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

        // Activate first file
        testApp.sendKey("Enter");
        testApp.render();

        // Navigate down to second file and activate
        testApp.sendKey("ArrowDown");
        testApp.sendKey("Enter");
        testApp.render();

        const editorGroupCtrl = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroupCtrl.editorCount).toBe(2);
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
});
