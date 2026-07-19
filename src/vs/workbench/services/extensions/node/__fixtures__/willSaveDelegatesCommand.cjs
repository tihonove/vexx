"use strict";

/**
 * Фикстура will-save: делегирует трансформацию встроенной команде ядра через
 * вложенный executeCommand внутри waitUntil (как стоковый editorconfig делегирует
 * editor.action.trimTrailingWhitespace активному документу). Проверяет, что
 * вложенный RPC во время pending will-save работает, а команда сама мутирует
 * буфер (участник при этом собственных TextEdit[] не возвращает).
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(function (event) {
            event.waitUntil(vscode.commands.executeCommand("editor.action.trimTrailingWhitespace"));
        }),
    );
};
