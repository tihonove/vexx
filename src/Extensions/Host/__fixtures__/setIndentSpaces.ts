import type * as vscode from "vscode";

import type { IExtensionEntry } from "../IExtensionEntry.ts";

/**
 * Тестовая фикстура: ставит редактору 2-space indent через публичный
 * vscode-API. Используется в `ExtensionHost.Indent.test.ts`.
 */
export const setIndentSpacesExtension: IExtensionEntry = {
    activate(_context: vscode.ExtensionContext, api: typeof vscode): void {
        const editor = api.window.activeTextEditor;
        if (editor === undefined) return;
        editor.options = { tabSize: 2, insertSpaces: true };
    },
};
