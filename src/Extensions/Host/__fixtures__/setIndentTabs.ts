import type * as vscode from "vscode";

import type { IExtensionEntry } from "../IExtensionEntry.ts";

/**
 * Тестовая фикстура: ставит редактору табы с шириной 8 через vscode-API.
 */
export const setIndentTabsExtension: IExtensionEntry = {
    activate(_context: vscode.ExtensionContext, api: typeof vscode): void {
        const editor = api.window.activeTextEditor;
        if (editor === undefined) return;
        editor.options = { tabSize: 8, insertSpaces: false };
    },
};
