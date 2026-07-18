import { createAppTestHarness, type IAppHarness } from "../../../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../TestUtils/TempWorkspace.ts";
import type { TestApp } from "../../../TestUtils/TestApp.ts";

import type { WorkbenchComponent } from "./WorkbenchComponent.ts";
import type { CompletionListElement } from "../../../TUIDom/Widgets/CompletionListElement.ts";
import { SuggestComponentDIToken } from "../../Components/Editor/SuggestComponent.ts";
import { CompletionServiceDIToken } from "../../Services/CompletionService.ts";
import type { ContextKeyService } from "../../Services/ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../../Services/ContextKeyService.ts";
import type { EditorPane } from "../../Components/Editor/EditorPane.ts";

/** Срез пары CompletionService+SuggestComponent для интеграционных тестов. */
export interface SuggestHandle {
    trigger(): Promise<void>;
    isOpen(): boolean;
    readonly view: CompletionListElement;
}

export interface SuggestContext {
    testApp: TestApp;
    workbench: WorkbenchComponent;
    contextKeys: ContextKeyService;
    activeEditor: () => EditorPane;
    completion: SuggestHandle;
    harness: IAppHarness;
    workspace: ITempWorkspace;
}

/** Boots a full Workbench over a real temp file with the editor focused. */
export function createSuggestApp(text: string): SuggestContext {
    const workspace = createTempWorkspace({ prefix: "vexx-suggest-app-", files: { "file.txt": text } });
    const harness = createAppTestHarness({
        openFile: workspace.path("file.txt"),
        focusEditor: true,
    });

    // Тот же синглтон-инстанс, что резолвил Workbench (контейнер кэширует).
    const service = harness.container.get(CompletionServiceDIToken);
    const view = harness.container.get(SuggestComponentDIToken).view;
    const completion: SuggestHandle = {
        trigger: () => service.trigger(),
        isOpen: () => service.isOpen(),
        view,
    };

    return {
        testApp: harness.testApp,
        workbench: harness.workbench,
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
