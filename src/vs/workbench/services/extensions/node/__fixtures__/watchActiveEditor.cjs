"use strict";

/**
 * Тестовая фикстура: подписывается на onDidChangeActiveTextEditor и
 * сигнализирует через tabSize о том, что событие пришло и document.fileName
 * содержит ожидаемый суффикс:
 *   - fileName оканчивается на ".ts"  → tabSize = 77
 *   - иначе                           → tabSize = 1
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(function (editor) {
            if (editor == null) return;
            var tabSize = editor.document.fileName.endsWith(".ts") ? 77 : 1;
            editor.options = { tabSize: tabSize };
        }),
    );
};
