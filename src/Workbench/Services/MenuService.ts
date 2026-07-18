import { token } from "../../Common/DiContainer.ts";

import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";

export const MenuServiceDIToken = token<MenuService>("MenuService");

/** Пункт меню: лейбл + id команды (+ отображаемый шорткат из реестра биндингов). */
export interface IMenuItemModel {
    readonly type: "item";
    readonly label: string;
    readonly commandId: string;
    readonly shortcut?: string;
}

export interface IMenuSeparatorModel {
    readonly type: "separator";
}

export type MenuEntryModel = IMenuItemModel | IMenuSeparatorModel;

/** Топ-уровневое меню (File/Edit/…): лейбл + мнемоника + пункты. */
export interface IMenuModel {
    readonly label: string;
    readonly mnemonic: string;
    readonly entries: readonly MenuEntryModel[];
}

/**
 * Декларативная модель главного меню: пункты собираются из command-id, про
 * контролы и исполнение сервис не знает (исполняет `MenuBarComponent` через
 * `CommandRegistry`). Отображаемый шорткат резолвится из
 * `KeybindingRegistry.getKeybindingForCommand` (тот же источник, что у command
 * palette), поэтому меню никогда не расходится с реальными биндингами — включая
 * пользовательские: модель строится после применения user keybindings.
 */
export class MenuService {
    public static dependencies = [KeybindingRegistryDIToken, ContextKeyServiceDIToken] as const;

    public constructor(
        private readonly keybindings: KeybindingRegistry,
        private readonly contextKeys: ContextKeyService,
    ) {}

    /** Снимок модели меню (шорткаты резолвятся на момент вызова). */
    public getMenus(): readonly IMenuModel[] {
        const item = (label: string, commandId: string): IMenuItemModel => {
            const chord = this.keybindings.getKeybindingForCommand(commandId, this.contextKeys);
            return {
                type: "item",
                label,
                commandId,
                shortcut: chord ? formatKeybinding(chord) : undefined,
            };
        };
        const sep = (): IMenuSeparatorModel => ({ type: "separator" });

        return [
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
                    item("Terminal", "workbench.action.terminal.toggleTerminal"),
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
    }
}
