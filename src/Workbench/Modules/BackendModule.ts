import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import type { IFileClipboard } from "../../Common/IFileClipboard.ts";
import { InMemoryClipboard } from "../../Common/InMemoryClipboard.ts";
import { InMemoryFileClipboard } from "../../Common/InMemoryFileClipboard.ts";
import { ClipboardDIToken, FileClipboardDIToken } from "../Services/CoreTokens.ts";

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
