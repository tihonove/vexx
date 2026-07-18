import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { typeText } from "../TestUtils/domQueries.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import type { TestApp } from "../TestUtils/TestApp.ts";

import type { AppController } from "./AppController.ts";
import type { ContextKeyService } from "../Workbench/Services/ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../Workbench/Services/ContextKeyService.ts";
import type { EditorPane } from "../Workbench/Components/Editor/EditorPane.ts";

export interface FindContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    activeEditor: () => EditorPane;
    tmpDir: string;
    harness: IAppHarness;
    workspace: ITempWorkspace;
}

/** Boots a full AppController over a real temp file with the editor focused. */
export function createFindApp(text: string): FindContext {
    const workspace = createTempWorkspace({ prefix: "vexx-find-app-", files: { "file.txt": text } });
    const harness = createAppTestHarness({
        openFile: workspace.path("file.txt"),
        focusEditor: true,
    });

    return {
        testApp: harness.testApp,
        controller: harness.controller,
        contextKeys: harness.container.get(ContextKeyServiceDIToken),
        activeEditor: () => harness.activeEditor(),
        tmpDir: workspace.dir,
        harness,
        workspace,
    };
}

/** Types each character into the focused find input. */
export function type(testApp: TestApp, text: string): void {
    typeText(testApp, text);
}

/** Tears down the controller and removes the temp directory. Use in afterEach. */
export function disposeFindApp(ctx: FindContext): void {
    ctx.harness.dispose();
    ctx.workspace.dispose();
}
