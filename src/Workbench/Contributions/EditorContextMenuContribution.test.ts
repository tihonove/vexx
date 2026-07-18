import { describe, expect, it } from "vitest";

import type { MenuEntry, MenuItemEntry } from "../../TUIDom/Widgets/PopupMenuElement.ts";
import type { EditorPane } from "../Components/Editor/EditorPane.ts";
import { MENU_CONTRIBUTIONS } from "../Menus/menuContributions.ts";
import { MenuId } from "../Menus/MenuId.ts";
import { MenuRegistry } from "../Menus/MenuRegistry.ts";
import { CommandRegistry } from "../Services/CommandRegistry.ts";
import { ContextKeyService } from "../Services/ContextKeyService.ts";
import type { EditorService } from "../Services/EditorService.ts";
import { KeybindingRegistry } from "../Services/KeybindingRegistry.ts";

import { EditorContextMenuContribution } from "./EditorContextMenuContribution.ts";

class FakeEditorService {
    public onEditorCreate?: (pane: EditorPane) => void;
    public createEditor(pane: FakePane): void {
        this.onEditorCreate?.(pane as unknown as EditorPane);
    }
}

class FakePane {
    public contextMenuProvider?: () => MenuEntry[];
}

function setup(): { pane: FakePane; executed: string[] } {
    const commands = new CommandRegistry();
    const executed: string[] = [];
    for (const [id, title] of [
        ["editor.action.clipboardCopyAction", "Copy"],
        ["editor.action.clipboardCutAction", "Cut"],
        ["editor.action.clipboardPasteAction", "Paste"],
        ["undo", "Undo"],
    ] as const) {
        commands.register(id, () => executed.push(id), title);
    }
    const menuRegistry = new MenuRegistry(commands, new KeybindingRegistry(), new ContextKeyService(), MENU_CONTRIBUTIONS);
    const editorService = new FakeEditorService();
    new EditorContextMenuContribution(editorService as unknown as EditorService, menuRegistry);
    const pane = new FakePane();
    editorService.createEditor(pane);
    return { pane, executed };
}

describe("EditorContextMenuContribution", () => {
    it("ставит провайдер контекст-меню редактора с пунктами из MenuRegistry", () => {
        const { pane } = setup();
        const entries = pane.contextMenuProvider!();
        expect(entries.map((e) => (e.type === "separator" ? "─" : e.label))).toEqual([
            "Copy",
            "Cut",
            "Paste",
            "─",
            "Undo",
        ]);
    });

    it("onSelect пунктов исполняет соответствующие команды", () => {
        const { pane, executed } = setup();
        const items = pane.contextMenuProvider!().filter((e): e is MenuItemEntry => e.type !== "separator");
        for (const item of items) item.onSelect?.();
        expect(executed).toEqual([
            "editor.action.clipboardCopyAction",
            "editor.action.clipboardCutAction",
            "editor.action.clipboardPasteAction",
            "undo",
        ]);
    });
});
