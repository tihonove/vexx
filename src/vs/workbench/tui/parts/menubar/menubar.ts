import type { MenuBarItem } from "../../../../base/tui/ui/menu/menuBarElement.ts";
import { MenuBarElement } from "../../../../base/tui/ui/menu/menuBarElement.ts";
import type { MenuEntry, MenuItemEntry } from "../../../../base/tui/ui/menu/popupMenuElement.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ContextKeyService } from "../../../../platform/contextkey/common/contextKeyService.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { formatKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { WorkbenchTheme } from "../../../services/themes/common/workbenchTheme.ts";

interface IMenubarDeps {
    readonly commands: CommandRegistry;
    readonly keybindings: KeybindingRegistry;
    readonly contextKeys: ContextKeyService;
    readonly theme: WorkbenchTheme;
}

/**
 * Строит меню-бар воркбенча (аналог vscode
 * `workbench/browser/parts/titlebar/menubarControl.ts`). Пункты ссылаются на
 * command id; отображаемый шорткат резолвится из реестра биндингов — тем же
 * источником, что и палитра команд, поэтому подписи не расходятся с реальными
 * сочетаниями.
 */
export function createWorkbenchMenuBar(deps: IMenubarDeps): MenuBarElement {
    const item = (label: string, commandId: string): MenuItemEntry => {
        const chord = deps.keybindings.getKeybindingForCommand(commandId, deps.contextKeys);
        return {
            label,
            shortcut: chord ? formatKeybinding(chord) : undefined,
            onSelect: () => {
                deps.commands.execute(commandId);
            },
        };
    };
    const sep = (): MenuEntry => ({ type: "separator" });

    const menuItems: MenuBarItem[] = [
        {
            label: "File",
            mnemonic: "f",
            entries: [
                item("New Untitled File", "workbench.action.files.newUntitledFile"),
                item("New File...", "explorer.newFile"),
                item("New Folder...", "explorer.newFolder"),
                sep(),
                item("Open File...", "workbench.action.files.openFile"),
                item("Open Folder...", "workbench.action.files.openFolder"),
                sep(),
                item("Save", "workbench.action.files.save"),
                item("Save As...", "workbench.action.files.saveAs"),
                sep(),
                item("Settings", "workbench.action.openSettings"),
                item("Keyboard Shortcuts", "workbench.action.openGlobalKeybindings"),
                sep(),
                item("Exit", "workbench.action.quit"),
            ],
        },
        {
            label: "Edit",
            mnemonic: "e",
            entries: [
                item("Undo", "undo"),
                item("Redo", "redo"),
                sep(),
                item("Cut", "editor.action.clipboardCutAction"),
                item("Copy", "editor.action.clipboardCopyAction"),
                item("Paste", "editor.action.clipboardPasteAction"),
                sep(),
                item("Find", "actions.find"),
                item("Find Next", "editor.action.nextMatchFindAction"),
                item("Find Previous", "editor.action.previousMatchFindAction"),
            ],
        },
        {
            label: "Selection",
            mnemonic: "s",
            entries: [
                item("Select All", "editor.action.selectAll"),
                sep(),
                item("Expand Selection (Word)", "cursorWordRightSelect"),
            ],
        },
        {
            label: "View",
            mnemonic: "v",
            entries: [
                item("Command Palette...", "workbench.action.showCommands"),
                sep(),
                item("Color Theme", "workbench.action.selectTheme"),
                sep(),
                item("Explorer", "workbench.view.explorer"),
                item("Problems", "workbench.actions.view.problems"),
                item("Toggle Primary Side Bar", "workbench.action.toggleSidebarVisibility"),
                item("Toggle Panel", "workbench.action.togglePanel"),
                sep(),
                item("Increase Side Bar Width", "workbench.action.increaseSidebarWidth"),
                item("Decrease Side Bar Width", "workbench.action.decreaseSidebarWidth"),
                item("Reset Side Bar Width", "workbench.action.resetSidebarWidth"),
            ],
        },
        {
            label: "Go",
            mnemonic: "g",
            entries: [
                item("Go to File...", "workbench.action.quickOpen"),
                item("Go to Line/Column...", "workbench.action.gotoLine"),
                sep(),
                item("Next Editor", "workbench.action.nextEditorInGroup"),
                item("Previous Editor", "workbench.action.previousEditorInGroup"),
                sep(),
                item("Close Editor", "workbench.action.closeActiveEditor"),
            ],
        },
        {
            label: "Help",
            mnemonic: "h",
            entries: [item("About", "workbench.action.showAboutDialog")],
        },
    ];

    const menuBar = new MenuBarElement(menuItems);
    menuBar.applyTheme(deps.theme);
    return menuBar;
}
