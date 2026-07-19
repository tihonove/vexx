import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../../../../platform/commands/common/commandRegistry.ts";
import type { WorkbenchContextKeys } from "../../../browser/workbenchContextKeys.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";

import { OpenFileCommandContribution } from "./openFileCommandContribution.ts";

class FakeEditorService {
    public opened: string[] = [];
    public openFile(path: string): void {
        this.opened.push(path);
    }
}

class FakeContextKeys {
    public updates = 0;
    public update(): void {
        this.updates++;
    }
}

describe("OpenFileCommandContribution", () => {
    it("регистрирует workbench.openFile: открывает файл и обновляет контекст-ключи", () => {
        const commands = new CommandRegistry();
        const editorService = new FakeEditorService();
        const contextKeys = new FakeContextKeys();
        new OpenFileCommandContribution(
            commands,
            editorService as unknown as EditorService,
            contextKeys as unknown as WorkbenchContextKeys,
        );

        commands.execute("workbench.openFile", "/ws/alpha.txt");

        expect(editorService.opened).toEqual(["/ws/alpha.txt"]);
        expect(contextKeys.updates).toBe(1);
    });

    it("команда без title — не попадает в палитру команд", () => {
        const commands = new CommandRegistry();
        new OpenFileCommandContribution(
            commands,
            new FakeEditorService() as unknown as EditorService,
            new FakeContextKeys() as unknown as WorkbenchContextKeys,
        );

        expect(commands.listCommands().some((c) => c.id === "workbench.openFile")).toBe(false);
    });
});
