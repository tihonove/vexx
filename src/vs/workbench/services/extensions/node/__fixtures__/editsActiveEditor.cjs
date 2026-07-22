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

    // Отдаёт выделение, каким его видит расширение ПРЯМО СЕЙЧАС. Тот же путь, что
    // у настоящих команд (maptz читает `ate.selection` и выходит на пустом), —
    // проверяет, что хост доносит движение каретки, а не только смену вкладки.
    context.subscriptions.push(
        vscode.commands.registerCommand("test.readSelection", function () {
            const editor = vscode.window.activeTextEditor;
            if (editor == null) return null;
            const sel = editor.selection;
            return {
                anchorLine: sel.anchor.line,
                anchorCharacter: sel.anchor.character,
                activeLine: sel.active.line,
                activeCharacter: sel.active.character,
                count: editor.selections.length,
                isEmpty: sel.isEmpty,
            };
        }),
    );

    // Fire-and-forget вызов несуществующей команды ядра: промис никто не ловит.
    // Ровно так делает maptz после wrapWithRegion (editor.action.formatDocument).
    context.subscriptions.push(
        vscode.commands.registerCommand("test.fireAndForgetMissingCommand", function () {
            void vscode.commands.executeCommand("no.such.core.command");
            return "issued";
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
