import { describe, expect, it } from "vitest";

import { InMemoryFileClipboard } from "../../Common/InMemoryFileClipboard.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { createTempWorkspace } from "../../TestUtils/TempWorkspace.ts";

import { CommandRegistry } from "./CommandRegistry.ts";
import type { DialogService } from "./DialogService.ts";
import type { ExplorerService } from "./ExplorerService.ts";
import { FileOperationsService } from "./FileOperationsService.ts";
import type { UndoRedoService } from "./Workspace/UndoRedoService.ts";
import type { WorkspaceEditService } from "./Workspace/WorkspaceEditService.ts";

/**
 * Юнит-крайности FileOperationsService: отменённый промпт (Escape / клик мимо →
 * `input()` резолвится undefined) оставляет create/rename no-op'ом. Основные
 * флоу покрыты интеграционно (AppController.FileCreate/FileRename/FileDelete/…).
 */
function makeService(explorer: Partial<ExplorerService>): { service: FileOperationsService; edits: unknown[] } {
    const edits: unknown[] = [];
    const workspaceEdits = {
        applyFileEdits: (list: unknown) => {
            edits.push(list);
            return null;
        },
    } as unknown as WorkspaceEditService;
    // Промпт, который пользователь сразу отменяет (шов IExplorerInputPrompt).
    const cancelledPrompt = { input: () => Promise.resolve(undefined) };
    const service = new FileOperationsService(
        explorer as ExplorerService,
        workspaceEdits,
        {} as UndoRedoService,
        {} as DialogService,
        NULL_CONFIGURATION_SERVICE,
        new InMemoryFileClipboard(),
        new CommandRegistry(),
        cancelledPrompt,
    );
    return { service, edits };
}

describe("FileOperationsService — отменённый промпт", () => {
    it("runCreate is a no-op when the prompt is cancelled", async () => {
        const ws = createTempWorkspace({ prefix: "vexx-fileops-" });
        const { service, edits } = makeService({ getPasteTargetDir: () => ws.dir });

        await expect(service.runCreate("file")).resolves.toBeUndefined();
        expect(edits).toEqual([]);
        ws.dispose();
    });

    it("runRename is a no-op when the prompt is cancelled", async () => {
        const { service, edits } = makeService({});

        await expect(service.runRename("/ws/old.txt")).resolves.toBeUndefined();
        expect(edits).toEqual([]);
    });
});
