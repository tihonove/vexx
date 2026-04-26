import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import { InMemoryClipboard } from "../../Common/InMemoryClipboard.ts";
import { ClipboardDIToken } from "../CoreTokens.ts";

export interface BackendModuleContext {
    clipboard: IClipboard;
}

/**
 * Внешние интеграции (clipboard, в будущем — файловая система и т.п.).
 * `clipboard` передаётся явно. Если нужно умолчание — см. `backendModuleDefault`.
 */
export const backendModule: ContainerModule<BackendModuleContext> = (container, { clipboard }) => {
    container.bind(ClipboardDIToken, () => clipboard);
};

/** Shortcut: `backendModule` с дефолтным `InMemoryClipboard`. */
export const backendModuleDefault: ContainerModule = (container) => {
    const clipboard = new InMemoryClipboard();
    container.bind(ClipboardDIToken, () => clipboard);
};
