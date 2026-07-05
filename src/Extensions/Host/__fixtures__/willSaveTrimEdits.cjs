"use strict";

/**
 * Фикстура will-save: подписывается на onWillSaveTextDocument и через waitUntil
 * возвращает правки — обрезает хвостовые пробелы каждой строки и добавляет
 * финальный перевод строки, если его нет. Проверяет реальное применение
 * TextEdit[] из участника к буферу и запись преобразованных байт на диск.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(function (event) {
            const doc = event.document;
            const edits = [];
            for (let i = 0; i < doc.lineCount; i++) {
                const text = doc.lineAt(i).text;
                const trimmed = text.replace(/[ \t]+$/, "");
                if (trimmed.length !== text.length) {
                    edits.push(vscode.TextEdit.delete(new vscode.Range(i, trimmed.length, i, text.length)));
                }
            }
            const last = doc.lineCount - 1;
            const lastText = doc.lineAt(last).text;
            if (lastText.length > 0) {
                edits.push(vscode.TextEdit.insert(new vscode.Position(last, lastText.length), "\n"));
            }
            event.waitUntil(Promise.resolve(edits));
        }),
    );
};
