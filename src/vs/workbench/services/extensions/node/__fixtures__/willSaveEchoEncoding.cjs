"use strict";

/**
 * Фикстура will-save: вставляет `document.encoding` первой строкой. Проверяет,
 * что кодировка ядрового документа доезжает по wire до ExtHostTextDocument
 * (issue #106: .encoding из снапшота, а не хардкод "utf8").
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(function (event) {
            const edit = vscode.TextEdit.insert(new vscode.Position(0, 0), "encoding=" + event.document.encoding + "\n");
            event.waitUntil(Promise.resolve([edit]));
        }),
    );
};
