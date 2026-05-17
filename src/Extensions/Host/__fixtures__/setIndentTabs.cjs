"use strict";

/**
 * Тестовая фикстура: ставит 8-tab indent активному редактору.
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    editor.options = { tabSize: 8, insertSpaces: false };
};
