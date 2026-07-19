import type { IMenuContribution } from "./IMenuContribution.ts";
import { MenuId } from "./MenuId.ts";

/** Контекст открытия ExplorerContext-меню (см. `args`/`visible` ниже). */
interface ExplorerMenuContext {
    readonly path: string;
    readonly canPaste: boolean;
}

/** Аргумент команды Explorer — путь выделенного узла. */
const pathArg = (context: unknown): readonly unknown[] => [(context as ExplorerMenuContext).path];
/** Видимость Paste — непустой буфер обмена файлов (императивно, при открытии). */
const canPaste = (context: unknown): boolean => (context as ExplorerMenuContext).canPaste;

/**
 * Явный список menu-contributions (зеркало `builtinActions`/`WORKBENCH_CONTRIBUTIONS`).
 * Пункты резолвит {@link MenuRegistry.getMenuItems}: label — из title команды или
 * явного `title`, шорткат — из `KeybindingRegistry`, порядок — group/order с
 * авто-разделителями между группами.
 *
 * Конвенция контекста открытия по меню:
 * - `EditorContext` → `undefined`;
 * - `ExplorerContext` → `{ path: string; canPaste: boolean }` (см. `args`/`visible`).
 */
export const MENU_CONTRIBUTIONS: readonly IMenuContribution[] = [
    // ─── EditorContext ─── (label из title команды: Copy/Cut/Paste/Undo)
    { menuId: MenuId.EditorContext, command: "editor.action.clipboardCopyAction", group: "1_clipboard", order: 10 },
    { menuId: MenuId.EditorContext, command: "editor.action.clipboardCutAction", group: "1_clipboard", order: 20 },
    { menuId: MenuId.EditorContext, command: "editor.action.clipboardPasteAction", group: "1_clipboard", order: 30 },
    { menuId: MenuId.EditorContext, command: "undo", group: "2_undo", order: 10 },

    // ─── ExplorerContext ─── (label явный — title команд «File: …»; args = путь узла)
    { menuId: MenuId.ExplorerContext, command: "explorer.newFile", title: "New File...", group: "1_new", order: 10, args: pathArg },
    { menuId: MenuId.ExplorerContext, command: "explorer.newFolder", title: "New Folder...", group: "1_new", order: 20, args: pathArg },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.copy", title: "Copy", group: "2_clipboard", order: 10 },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.cut", title: "Cut", group: "2_clipboard", order: 20 },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.paste", title: "Paste", group: "2_clipboard", order: 30, visible: canPaste },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.copyPath", title: "Copy Path", group: "3_copypath", order: 10, args: pathArg },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.copyRelativePath", title: "Copy Relative Path", group: "3_copypath", order: 20, args: pathArg },
    { menuId: MenuId.ExplorerContext, command: "fileOperations.rename", title: "Rename...", group: "4_modify", order: 10, args: pathArg },
    // Delete забинжен `delete`, но меню шортката не показывает — подавляем.
    { menuId: MenuId.ExplorerContext, command: "fileOperations.deleteFile", title: "Delete", group: "4_modify", order: 20, args: pathArg, shortcut: false },
    { menuId: MenuId.ExplorerContext, command: "workbench.files.action.refreshFilesExplorer", title: "Refresh Explorer", group: "5_refresh", order: 10 },
];
