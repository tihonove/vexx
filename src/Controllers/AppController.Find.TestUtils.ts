import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppControllerDIToken } from "./AppController.ts";
import type { AppController } from "./AppController.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import type { EditorController } from "./EditorController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

export interface FindContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    activeEditor: () => EditorController;
    tmpDir: string;
}

/** Boots a full AppController over a real temp file with the editor focused. */
export function createFindApp(text: string): FindContext {
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
export function type(testApp: TestApp, text: string): void {
    for (const ch of text) testApp.sendKey(ch);
}

/** Tears down the controller and removes the temp directory. Use in afterEach. */
export function disposeFindApp(ctx: FindContext): void {
    ctx.controller.dispose();
    fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
}
