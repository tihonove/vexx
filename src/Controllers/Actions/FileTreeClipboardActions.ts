import type { IFileClipboard } from "../../Common/IFileClipboard.ts";
import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

import { copyInto, moveInto } from "./fileClipboardFs.ts";

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

export interface PasteResult {
    /** Пути успешно вставленных записей. */
    pasted: string[];
    /** Записи, которые не удалось вставить, с сообщением об ошибке. */
    errors: { path: string; message: string }[];
}

/**
 * Выполняет вставку содержимого файлового буфера в `targetDir`. В режиме `cut`
 * перемещает (и очищает буфер после), в режиме `copy` — копирует. Каждая запись
 * обрабатывается независимо; ошибка по одной не прерывает остальные.
 */
export function pasteFiles(clipboard: IFileClipboard, targetDir: string): PasteResult {
    const result: PasteResult = { pasted: [], errors: [] };
    const entry = clipboard.read();
    if (!entry) return result;

    for (const src of entry.paths) {
        try {
            const dest = entry.mode === "cut" ? moveInto(src, targetDir) : copyInto(src, targetDir);
            result.pasted.push(dest);
        } catch (error) {
            result.errors.push({ path: src, message: (error as Error).message });
        }
    }

    if (entry.mode === "cut") {
        clipboard.clear();
    }
    return result;
}
