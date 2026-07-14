import type { ContainerModule } from "../../vs/platform/instantiation/common/instantiation.ts";
import type { IClipboard } from "../../vs/platform/clipboard/common/clipboardService.ts";
import type { IFileClipboard } from "../../vs/platform/clipboard/common/fileClipboard.ts";
import { InMemoryClipboard } from "../../vs/platform/clipboard/common/inMemoryClipboard.ts";
import { InMemoryFileClipboard } from "../../vs/platform/clipboard/common/inMemoryFileClipboard.ts";
import { ClipboardDIToken, FileClipboardDIToken } from "../CoreTokens.ts";

export interface BackendModuleContext {
    clipboard: IClipboard;
    /** Файловый буфер explorer. По умолчанию — in-memory; в будущем тут можно прокинуть нативную реализацию. */
    fileClipboard?: IFileClipboard;
}

/**
 * Внешние интеграции (clipboard, в будущем — файловая система и т.п.).
 * `clipboard` передаётся явно. Если нужно умолчание — см. `backendModuleDefault`.
 */
export const backendModule: ContainerModule<BackendModuleContext> = (container, { clipboard, fileClipboard }) => {
    container.bind(ClipboardDIToken, () => clipboard);
    const files = fileClipboard ?? new InMemoryFileClipboard();
    container.bind(FileClipboardDIToken, () => files);
};

/** Shortcut: `backendModule` с дефолтным `InMemoryClipboard`. */
export const backendModuleDefault: ContainerModule = (container) => {
    const clipboard = new InMemoryClipboard();
    container.bind(ClipboardDIToken, () => clipboard);
    const fileClipboard = new InMemoryFileClipboard();
    container.bind(FileClipboardDIToken, () => fileClipboard);
};
