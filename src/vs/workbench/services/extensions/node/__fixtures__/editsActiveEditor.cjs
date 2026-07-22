"use strict";

/**
 * Фикстура для extensionHost.editorWrite.test.ts.
 * Регистрирует команды, которые пишут в активный редактор — тот же путь, что
 * команды maptz.regionfolder (selection setter + editor.edit).
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");

    // Вставляет "X" в начало документа через editor.edit (undoable-батч).
    context.subscriptions.push(
        vscode.commands.registerCommand("test.insertX", async function () {
            const editor = vscode.window.activeTextEditor;
            if (editor == null) return false;
            return editor.edit(function (edit) {
                edit.insert(new vscode.Position(0, 0), "X");
            });
        }),
    );

    // Выставляет выделение первой строки целиком.
    context.subscriptions.push(
        vscode.commands.registerCommand("test.selectFirstLine", function () {
            const editor = vscode.window.activeTextEditor;
            if (editor == null) return;
            editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 3));
        }),
    );

    // Число видимых редакторов (проверка window.visibleTextEditors).
    context.subscriptions.push(
        vscode.commands.registerCommand("test.visibleCount", function () {
            return vscode.window.visibleTextEditors.length;
        }),
    );

    // Удаляет первую строку через editor.edit(delete).
    context.subscriptions.push(
        vscode.commands.registerCommand("test.deleteFirstLine", function () {
            const editor = vscode.window.activeTextEditor;
            if (editor == null) return false;
            return editor.edit(function (edit) {
                edit.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)));
            });
        }),
    );
};
