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
 * Юнит-крайности FileOperationsService: без прикреплённого inputPrompt
 * (QuickInput ещё не отдан владельцем) create/rename — no-op. Основные флоу
 * покрыты интеграционно (AppController.FileCreate/FileRename/FileDelete/…).
 */
function makeService(explorer: Partial<ExplorerService>): { service: FileOperationsService; edits: unknown[] } {
    const edits: unknown[] = [];
    const workspaceEdits = {
        applyFileEdits: (list: unknown) => {
            edits.push(list);
            return null;
        },
    } as unknown as WorkspaceEditService;
    const service = new FileOperationsService(
        explorer as ExplorerService,
        workspaceEdits,
        {} as UndoRedoService,
        {} as DialogService,
        NULL_CONFIGURATION_SERVICE,
        new InMemoryFileClipboard(),
        new CommandRegistry(),
    );
    return { service, edits };
}

describe("FileOperationsService — без прикреплённого inputPrompt", () => {
    it("runCreate is a no-op when no input prompt is attached", async () => {
        const ws = createTempWorkspace({ prefix: "vexx-fileops-" });
        const { service, edits } = makeService({ getPasteTargetDir: () => ws.dir });

        await expect(service.runCreate("file")).resolves.toBeUndefined();
        expect(edits).toEqual([]);
        ws.dispose();
    });

    it("runRename is a no-op when no input prompt is attached", async () => {
        const { service, edits } = makeService({});

        await expect(service.runRename("/ws/old.txt")).resolves.toBeUndefined();
        expect(edits).toEqual([]);
    });
});
