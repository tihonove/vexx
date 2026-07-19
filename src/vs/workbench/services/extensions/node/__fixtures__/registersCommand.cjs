"use strict";

/**
 * Фикстура для ExtensionHost.Commands.test.ts — направление host → subprocess.
 * Регистрирует команду `test.applyTab`; когда ядро исполняет её (через прокси в
 * host CommandRegistry), хендлер ставит tabSize активного редактора из аргумента.
 * Сигнал наружу — через editor.options (принятая конвенция фикстур).
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.commands.registerCommand("test.applyTab", function (n) {
            const editor = vscode.window.activeTextEditor;
            if (editor == null) return "no-editor";
            editor.options = { tabSize: n };
            return "applied:" + n;
        }),
    );
};
