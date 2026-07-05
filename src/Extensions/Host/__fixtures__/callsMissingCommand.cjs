"use strict";

/**
 * Фикстура для ExtensionHost.Commands.test.ts — reject неизвестной команды.
 * `does.not.exist` нет ни локально, ни в host CommandRegistry, поэтому
 * executeCommand отклоняется. Ловим reject и сигналим маркером tabSize=3.
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    return vscode.commands.executeCommand("does.not.exist").then(
        function () {
            // не должно случиться
        },
        function () {
            const editor = vscode.window.activeTextEditor;
            if (editor != null) editor.options = { tabSize: 3 };
        },
    );
};
