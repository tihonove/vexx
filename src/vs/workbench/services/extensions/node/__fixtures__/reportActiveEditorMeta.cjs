"use strict";

/**
 * Тестовая фикстура для ExtensionHost.ActiveEditor.test.ts.
 *
 * На смене активного редактора проверяет:
 *   - document.languageId === "typescript" (пришёл в meta через wire);
 *   - стабильную идентичность: workspace.textDocuments содержит РОВНО тот же
 *     объект, что и activeTextEditor.document (сравнение по ссылке).
 * Сигналит успех через tabSize=71, иначе tabSize=13.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(function (editor) {
            if (editor == null) return;
            var doc = editor.document;
            var identityOk = vscode.workspace.textDocuments.indexOf(doc) >= 0;
            var ok = doc.languageId === "typescript" && identityOk;
            editor.options = { tabSize: ok ? 71 : 13 };
        }),
    );
};
