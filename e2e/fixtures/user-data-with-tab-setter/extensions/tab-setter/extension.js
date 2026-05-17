"use strict";

/**
 * E2E user extension: subprocess extension host загружает этот CJS-файл и
 * вызывает `activate()`. Расширение ставит уникальный tabSize=7 на активный
 * редактор; e2e тест проверяет визуальную раскладку tab-символов.
 */
exports.activate = function activate(_context) {
    const vscode = require("vscode");
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    editor.options = { tabSize: 7, insertSpaces: false };
};

exports.deactivate = function deactivate() {};
