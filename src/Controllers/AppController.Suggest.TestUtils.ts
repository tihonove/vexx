import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import type { AppController } from "./AppController.ts";
import { AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { EditorController } from "./EditorController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

export interface SuggestContext {
    testApp: TestApp;
    controller: AppController;
    contextKeys: ContextKeyService;
    commands: CommandRegistry;
    activeEditor: () => EditorController;
    /** Явно триггерит автодополнение и ждёт открытия попапа (async trigger). */
    triggerSuggest: () => Promise<void>;
    tmpDir: string;
}

/** Boots a full AppController over a real temp file with the editor focused. */
export function createSuggestApp(text: string): SuggestContext {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-suggest-app-"));
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
    const commands = container.get(CommandRegistryDIToken);
    return {
        testApp,
        controller,
        contextKeys: container.get(ContextKeyServiceDIToken),
        commands,
        activeEditor: () => {
            const editor = group.getActiveEditor();
            /* v8 ignore start -- test helper: every suggest scenario opens an editor before reading it */
            if (editor === null) throw new Error("expected an active editor");
            /* v8 ignore stop */
            return editor;
        },
        triggerSuggest: async () => {
            commands.execute("editor.action.triggerSuggest");
            // trigger() is async (awaits the completion source); let it settle so the
            // popup is open before the test dispatches navigation keys.
            for (let i = 0; i < 5; i++) await Promise.resolve();
            testApp.render();
        },
        tmpDir,
    };
}

/** Types each character into the focused editor (one keypress per char). */
export function type(testApp: TestApp, text: string): void {
    for (const ch of text) testApp.sendKey(ch);
}

/** Tears down the controller and removes the temp directory. Use in afterEach. */
export function disposeSuggestApp(ctx: SuggestContext): void {
    ctx.controller.dispose();
    fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
}
