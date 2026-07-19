"use strict";

/**
 * Фикстура для ExtensionHost.Completion.test.ts.
 * Регистрирует completion-провайдер для языка editorconfig (селектор с pattern)
 * и команду `editorconfig._triggerSuggestAfterDelay` (аналог реальной команды
 * расширения). Провайдер отдаёт два свойства; у первого — `command`, чей
 * хендлер выставляет tabSize=6 активного редактора как наблюдаемый сигнал того,
 * что item.command доехал через commands bridge.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");

    context.subscriptions.push(
        vscode.commands.registerCommand("editorconfig._triggerSuggestAfterDelay", function () {
            const editor = vscode.window.activeTextEditor;
            if (editor != null) editor.options = { tabSize: 6 };
            return "retriggered";
        }),
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: "editorconfig", pattern: "**/.editorconfig" },
            {
                provideCompletionItems: function () {
                    const style = new vscode.CompletionItem("indent_style", vscode.CompletionItemKind.Property);
                    style.detail = "EditorConfig";
                    style.command = { command: "editorconfig._triggerSuggestAfterDelay", title: "" };
                    const size = new vscode.CompletionItem("indent_size", vscode.CompletionItemKind.Property);
                    return [style, size];
                },
            },
        ),
    );
};
