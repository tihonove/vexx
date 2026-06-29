import type { FileClipboardEntry } from "../../Common/IFileClipboard.ts";
import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";
import type { ResourceFileEdit } from "../Workspace/WorkspaceEdit.ts";

/**
 * Дескрипторы команд copy/cut/paste для explorer (без `run` — он привязывается в
 * AppController, где доступны FileTreeController и файловый буфер). Все под `listFocus`,
 * так что ctrl+c/x/v не конфликтуют с редакторскими (те под `textInputFocus`).
 */
export const fileCopyAction = {
    id: "fileOperations.copy",
    title: "File: Copy",
    keybinding: parseKeybinding("ctrl+c"),
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;

export const fileCutAction = {
    id: "fileOperations.cut",
    title: "File: Cut",
    keybinding: parseKeybinding("ctrl+x"),
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;

export const filePasteAction = {
    id: "fileOperations.paste",
    title: "File: Paste",
    keybinding: parseKeybinding("ctrl+v"),
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;

/**
 * Превращает содержимое файлового буфера в набор `ResourceFileEdit` для вставки в `targetDir`:
 * режим `cut` → перемещение, `copy` → копирование. Исполнение и запись в историю отмены —
 * на стороне `WorkspaceEditService.applyFileEdits`.
 */
export function buildPasteEdits(entry: FileClipboardEntry, targetDir: string): ResourceFileEdit[] {
    const kind = entry.mode === "cut" ? "move" : "copy";
    return entry.paths.map((from) => ({ kind, from, to: targetDir }));
}
