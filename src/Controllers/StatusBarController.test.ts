import { describe, expect, it } from "vitest";

import { Container } from "../Common/DiContainer.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./StatusBarController.ts";

function createStatusBarController(): {
    statusBarController: StatusBarController;
    editorGroupController: EditorGroupController;
} {
    const container = new Container();
    container
        .bind(ThemeServiceDIToken, () => new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)))
        .bind(TokenizationRegistryDIToken, () => new TokenizationRegistry())
        .bind(TokenStyleResolverDIToken, () => NULL_TOKEN_STYLE_RESOLVER)
        .bind(EditorGroupControllerDIToken, EditorGroupController)
        .bind(StatusBarControllerDIToken, StatusBarController);

    const editorGroupController = container.get(EditorGroupControllerDIToken);
    const statusBarController = container.get(StatusBarControllerDIToken);

    editorGroupController.mount();

    return { statusBarController, editorGroupController };
}

describe("StatusBarController", () => {
    it("view is a StatusBarElement", () => {
        const { statusBarController } = createStatusBarController();
        expect(statusBarController.view).toBeDefined();
        expect(statusBarController.view.constructor.name).toBe("StatusBarElement");
    });

    it("shows no items when no file is open", () => {
        const { statusBarController } = createStatusBarController();
        statusBarController.mount();

        expect(statusBarController.view.getItems()).toEqual([]);
    });

    it("shows file name after update when file is opened", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-file.txt");
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toEqual([{ text: "test-statusbar-file.txt" }]);
    });

    it("shows [Modified] after text is edited", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-mod.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        const editorElement = activeEditor.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");

        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toContainEqual({ text: "test-statusbar-mod.txt" });
        expect(items).toContainEqual({ text: "[Modified]" });
    });

    it("clears [Modified] after save", () => {
        const { statusBarController, editorGroupController } = createStatusBarController();
        statusBarController.mount();

        editorGroupController.openFile("/tmp/test-statusbar-save.txt");

        const activeEditor = editorGroupController.getActiveEditor()!;
        const editorElement = activeEditor.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");

        statusBarController.update();
        expect(statusBarController.view.getItems()).toContainEqual({ text: "[Modified]" });

        activeEditor.save();
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toEqual([{ text: "test-statusbar-save.txt" }]);
    });
});
