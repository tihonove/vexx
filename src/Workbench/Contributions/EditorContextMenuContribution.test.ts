import { describe, expect, it } from "vitest";

import type { MenuEntry } from "../../TUIDom/Widgets/PopupMenuElement.ts";
import type { EditorPane } from "../Components/Editor/EditorPane.ts";
import type { CommandRegistry } from "../Services/CommandRegistry.ts";
import type { EditorService } from "../Services/EditorService.ts";

import { EditorContextMenuContribution } from "./EditorContextMenuContribution.ts";

class FakeEditorService {
    public onEditorCreate?: (pane: EditorPane) => void;
    public createEditor(pane: FakePane): void {
        this.onEditorCreate?.(pane as unknown as EditorPane);
    }
}

class FakePane {
    public contextMenuEntries: MenuEntry[] = [];
}

class FakeCommands {
    public executed: string[] = [];
    public execute(id: string): void {
        this.executed.push(id);
    }
}

function menuItem(entry: MenuEntry): { label?: string; onSelect?: () => void } {
    return entry as { label?: string; onSelect?: () => void };
}

describe("EditorContextMenuContribution", () => {
    it("наполняет контекст-меню создаваемого редактора стандартными пунктами", () => {
        const editorService = new FakeEditorService();
        const commands = new FakeCommands();
        new EditorContextMenuContribution(
            editorService as unknown as EditorService,
            commands as unknown as CommandRegistry,
        );
        const pane = new FakePane();

        editorService.createEditor(pane);

        expect(pane.contextMenuEntries.map((e) => menuItem(e).label)).toEqual([
            "Copy",
            "Cut",
            "Paste",
            undefined, // separator
            "Undo",
        ]);
    });

    it("onSelect пунктов исполняет соответствующие команды", () => {
        const editorService = new FakeEditorService();
        const commands = new FakeCommands();
        new EditorContextMenuContribution(
            editorService as unknown as EditorService,
            commands as unknown as CommandRegistry,
        );
        const pane = new FakePane();
        editorService.createEditor(pane);

        for (const entry of pane.contextMenuEntries) menuItem(entry).onSelect?.();

        expect(commands.executed).toEqual([
            "editor.action.clipboardCopyAction",
            "editor.action.clipboardCutAction",
            "editor.action.clipboardPasteAction",
            "undo",
        ]);
    });
});
