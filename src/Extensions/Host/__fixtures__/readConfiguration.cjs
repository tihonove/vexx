"use strict";

/**
 * Тестовая фикстура для ExtensionHost.Configuration.test.ts.
 *
 * Читает конфигурацию двух слоёв через vscode.workspace.getConfiguration и
 * сигналит результат через editor.options активного редактора:
 *   - tabSize      ← getConfiguration("editor").get("tabSize")  (user-снапшот)
 *   - insertSpaces ← getConfiguration("editorconfig").get("spaces")  (contributed default)
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    const tabSize = vscode.workspace.getConfiguration("editor").get("tabSize");
    const spaces = vscode.workspace.getConfiguration("editorconfig").get("spaces");
    editor.options = { tabSize: tabSize, insertSpaces: spaces };
};
