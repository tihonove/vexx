"use strict";

/**
 * Фикстура will-save: возвращает единственную правку смены EOL на CRLF через
 * TextEdit.setEndOfLine. Проверяет, что wire-эдит setEndOfLine доезжает до ядра
 * (doc.setEol из WP5) и байты на диске содержат \r\n.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(function (event) {
            event.waitUntil(Promise.resolve([vscode.TextEdit.setEndOfLine(vscode.EndOfLine.CRLF)]));
        }),
    );
};
