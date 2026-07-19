"use strict";

/**
 * Фикстура did-save: на onDidSaveTextDocument выставляет tabSize активного
 * редактора в маркер 42. Проверяет, что post-save notify доезжает до расширения
 * (и что подписка гейтит отправку — без onWillSave will-save RPC не идёт).
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(function () {
            const editor = vscode.window.activeTextEditor;
            if (editor != null) editor.options = { tabSize: 42 };
        }),
    );
};
