"use strict";

/**
 * Фикстура для extensionHost.folding.test.ts.
 * Регистрирует folding-провайдер для языка csharp (селектор — массив language-id,
 * как у стокового maptz.regionfolder). Провайдер сканирует строки документа на
 * маркеры `#region` / `#endregion` и возвращает `vscode.FoldingRange` вида Region
 * — тот же путь, что MyFoldingRangeProvider реального расширения.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");

    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(["csharp"], {
            provideFoldingRanges: function (document) {
                const lines = document.getText().split("\n");
                const stack = [];
                const ranges = [];
                for (let i = 0; i < lines.length; i++) {
                    if (/#region\b/.test(lines[i])) {
                        stack.push(i);
                    } else if (/#endregion\b/.test(lines[i])) {
                        const start = stack.pop();
                        if (start !== undefined) {
                            ranges.push(new vscode.FoldingRange(start, i, vscode.FoldingRangeKind.Region));
                        }
                    }
                }
                return ranges;
            },
        }),
    );
};
