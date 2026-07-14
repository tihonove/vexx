"use strict";

/**
 * Тестовая фикстура для ExtensionHost.test.ts / Indent.test.ts.
 * Ставит 2-space indent активному редактору через публичный vscode API.
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    editor.options = { tabSize: 2, insertSpaces: true };
};
