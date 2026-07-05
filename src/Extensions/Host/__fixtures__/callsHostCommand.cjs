"use strict";

/**
 * Фикстура для ExtensionHost.Commands.test.ts — направление subprocess → host
 * (fall-through). Команды `test.hostApply` нет в локальной Map сабпроцесса,
 * поэтому executeCommand уходит RPC'ом на хост и исполняется в CommandRegistry.
 * Возвращаем thenable из activate — хост его дожидается.
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    return vscode.commands.executeCommand("test.hostApply", 7);
};
