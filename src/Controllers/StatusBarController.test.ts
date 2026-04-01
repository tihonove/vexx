import { describe, expect, it } from "vitest";

import { Container } from "../Common/DiContainer.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";

import { EditorController, EditorControllerDIToken } from "./EditorController.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./StatusBarController.ts";

function createStatusBarController(): { statusBarController: StatusBarController; editorController: EditorController } {
    const container = new Container();
    container.bind(EditorControllerDIToken, EditorController).bind(StatusBarControllerDIToken, StatusBarController);

    const editorController = container.get(EditorControllerDIToken);
    const statusBarController = container.get(StatusBarControllerDIToken);

    return { statusBarController, editorController };
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
        const { statusBarController, editorController } = createStatusBarController();
        statusBarController.mount();

        editorController.openFile("/tmp/test-statusbar-file.txt");
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toEqual([{ text: "test-statusbar-file.txt" }]);
    });

    it("shows [Modified] after text is edited", () => {
        const { statusBarController, editorController } = createStatusBarController();
        statusBarController.mount();

        editorController.openFile("/tmp/test-statusbar-mod.txt");

        // Simulate editing by accessing the document via getText/internal state
        // EditorController exposes getText but not a direct edit method,
        // so we trigger modification through the view state
        const editorElement = editorController.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");

        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toContainEqual({ text: "test-statusbar-mod.txt" });
        expect(items).toContainEqual({ text: "[Modified]" });
    });

    it("clears [Modified] after save", () => {
        const { statusBarController, editorController } = createStatusBarController();
        statusBarController.mount();

        editorController.openFile("/tmp/test-statusbar-save.txt");

        const editorElement = editorController.view.querySelector("EditorElement") as EditorElement;
        editorElement.viewState.type("x");

        statusBarController.update();
        expect(statusBarController.view.getItems()).toContainEqual({ text: "[Modified]" });

        editorController.save();
        statusBarController.update();

        const items = statusBarController.view.getItems();
        expect(items).toEqual([{ text: "test-statusbar-save.txt" }]);
    });
});
