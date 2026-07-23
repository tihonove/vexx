import { describe, expect, it } from "vitest";

import type { MenuEntry, MenuItemEntry } from "../../../../../../tuidom/ui/menu/popupMenuElement.ts";
import { MenuId } from "../../../../platform/actions/common/menuId.ts";
import { MenuRegistry } from "../../../../platform/actions/common/menuRegistry.ts";
import { MenuService } from "../../../../platform/actions/common/menuService.ts";
import { CommandRegistry } from "../../../../platform/commands/common/commandRegistry.ts";
import { ContextKeyService } from "../../../../platform/contextkey/common/contextKeyService.ts";
import { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingRegistry.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";
import { MENU_CONTRIBUTIONS } from "../../actions/menuContributions.ts";

import { EditorContextMenuContribution } from "./editorContextMenuContribution.ts";
import type { TextEditorPane } from "./textEditorPane.ts";

class FakeEditorService {
    public onEditorCreate?: (pane: TextEditorPane) => void;
    public createEditor(pane: FakePane): void {
        this.onEditorCreate?.(pane as unknown as TextEditorPane);
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
    const menuService = new MenuService(
        new MenuRegistry(commands, new KeybindingRegistry(), new ContextKeyService(), MENU_CONTRIBUTIONS),
    );
    const editorService = new FakeEditorService();
    new EditorContextMenuContribution(editorService as unknown as EditorService, menuService);
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
