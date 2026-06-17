import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { EditorController } from "./EditorController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface FindContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    activeEditor: () => EditorController;
    tmpDir: string;
}

function createFindApp(text: string): FindContext {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-find-app-"));
    const filePath = path.join(tmpDir, "file.txt");
    fs.writeFileSync(filePath, text);

    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);

    controller.openFile(filePath);
    controller.focusEditor();
    testApp.render();

    const group = container.get(EditorGroupControllerDIToken);
    return {
        testApp,
        controller,
        contextKeys: container.get(ContextKeyServiceDIToken),
        activeEditor: () => group.getActiveEditor() as EditorController,
        tmpDir,
    };
}

/** Types each character into the focused find input. */
function type(testApp: TestApp, text: string): void {
    for (const ch of text) testApp.sendKey(ch);
}

describe("AppController — find in file", () => {
    let ctx: FindContext;

    afterEach(() => {
        ctx.controller.dispose();
        fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
    });

    it("Ctrl+F opens the find widget and focuses its input", () => {
        ctx = createFindApp("foo bar foo");
        expect(ctx.contextKeys.get("findWidgetVisible")).toBe(false);

        ctx.testApp.sendKey("Ctrl+F");
        expect(ctx.testApp.focusedElement?.constructor.name).toBe("InputElement");

        // The next dispatch refreshes context keys while the widget is open.
        type(ctx.testApp, "f");
        expect(ctx.contextKeys.get("findWidgetVisible")).toBe(true);
    });

    it("typing into the find widget does not modify the document", () => {
        ctx = createFindApp("foo bar foo");
        const before = ctx.activeEditor().getText();

        ctx.testApp.sendKey("Ctrl+F");
        type(ctx.testApp, "foo");

        expect(ctx.activeEditor().getText()).toBe(before);
        // …but the query did reach the find widget (matches highlighted).
        expect(ctx.activeEditor().viewState.searchMatches).toHaveLength(2);
    });

    it("Enter advances to the next match and wraps around", () => {
        ctx = createFindApp("foo bar foo");
        ctx.testApp.sendKey("Ctrl+F");
        type(ctx.testApp, "foo");
        expect(ctx.activeEditor().viewState.currentSearchMatchIndex).toBe(0);

        ctx.testApp.sendKey("Enter");
        expect(ctx.activeEditor().viewState.currentSearchMatchIndex).toBe(1);
        ctx.testApp.sendKey("Enter"); // wraps back to the first match
        expect(ctx.activeEditor().viewState.currentSearchMatchIndex).toBe(0);
    });

    it("F3 / Shift+F3 navigate forward and backward", () => {
        ctx = createFindApp("foo bar foo");
        ctx.testApp.sendKey("Ctrl+F");
        type(ctx.testApp, "foo");

        ctx.testApp.sendKey("F3");
        expect(ctx.activeEditor().viewState.currentSearchMatchIndex).toBe(1);
        ctx.testApp.sendKey("Shift+F3");
        expect(ctx.activeEditor().viewState.currentSearchMatchIndex).toBe(0);
    });

    it("Escape closes the widget, clears highlights and returns focus to the editor", () => {
        ctx = createFindApp("foo bar foo");
        ctx.testApp.sendKey("Ctrl+F");
        type(ctx.testApp, "foo");
        expect(ctx.activeEditor().viewState.searchMatches).toHaveLength(2);

        ctx.testApp.sendKey("Escape");

        expect(ctx.testApp.focusedElement?.constructor.name).toBe("EditorElement");
        expect(ctx.activeEditor().viewState.searchMatches).toEqual([]);
    });
});
