import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import type { TestApp } from "../TestUtils/TestApp.ts";

import type { AppController } from "./AppController.ts";
import type { CompletionController } from "../vs/editor/contrib/suggest/tui/completionController.ts";
import type { ContextKeyService } from "../vs/platform/contextkey/common/contextKeyService.ts";
import { ContextKeyServiceDIToken } from "../vs/platform/contextkey/common/contextKeyService.ts";
import type { EditorController } from "./EditorController.ts";

export interface SuggestContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    activeEditor: () => EditorController;
    completion: CompletionController;
    harness: IAppHarness;
    workspace: ITempWorkspace;
}

/** Boots a full AppController over a real temp file with the editor focused. */
export function createSuggestApp(text: string): SuggestContext {
    const workspace = createTempWorkspace({ prefix: "vexx-suggest-app-", files: { "file.txt": text } });
    const harness = createAppTestHarness({
        openFile: workspace.path("file.txt"),
        focusEditor: true,
    });

    const completion = (harness.controller as unknown as { completionController: CompletionController })
        .completionController;

    return {
        testApp: harness.testApp,
        controller: harness.controller,
        contextKeys: harness.container.get(ContextKeyServiceDIToken),
        activeEditor: () => harness.activeEditor(),
        completion,
        harness,
        workspace,
    };
}

export function disposeSuggestApp(ctx: SuggestContext): void {
    ctx.harness.dispose();
    ctx.workspace.dispose();
}
