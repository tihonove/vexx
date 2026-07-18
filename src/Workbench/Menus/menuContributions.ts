import type { IMenuContribution } from "./IMenuContribution.ts";
import { MenuId } from "./MenuId.ts";

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
];
