"use strict";

/**
 * Фикстура для ExtensionHost.Commands.test.ts — local-first executeCommand.
 * Регистрирует команду и тут же сама её вызывает: команда есть в локальной Map,
 * значит исполняется прямо в сабпроцессе без RPC на хост. Ставит tabSize=9.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.commands.registerCommand("test.localApply", function (n) {
            const editor = vscode.window.activeTextEditor;
            if (editor != null) editor.options = { tabSize: n };
            return n;
        }),
    );
    return vscode.commands.executeCommand("test.localApply", 9);
};
