import * as vscode from "vscode";

import { SETTINGS_SCHEMA } from "./settings-schema.generated.ts";

/**
 * Built-in Settings-editing extension (subprocess extension, plugin-API only).
 *
 * Демонстрирует ленивую активацию: активируется ТОЛЬКО при открытии JSON-документа
 * (`activationEvents: ["onLanguage:json", "onLanguage:jsonc"]`) — пока пользователь
 * не открыл JSON, subprocess под расширение не поднимается. Открыв `settings.json`
 * (Ctrl+,), пользователь получает автодополнение известных ключей настроек.
 *
 * Каталог ключей вшит на этапе сборки: `settings-schema.generated.ts` генерируется
 * `scripts/generate-settings-schema.mjs` из app-дефолтов + `contributes.configuration`
 * всех builtin-расширений и бандлится в `out/extension.cjs`. Никакого рантайм-API
 * за схемой расширение не ходит.
 */
export function activate(context: { readonly subscriptions: { dispose(): unknown }[] }): void {
    // Селектор с `pattern:"**/settings.json"`: активируемся на любом JSON
    // (onLanguage:json/jsonc), но подсказки отдаём только для файла настроек.
    const selector = [
        { language: "json", pattern: "**/settings.json" },
        { language: "jsonc", pattern: "**/settings.json" },
    ];

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            selector,
            {
                provideCompletionItems(): vscode.CompletionItem[] {
                    return SETTINGS_SCHEMA.map((entry) => {
                        const item = new vscode.CompletionItem(entry.key, vscode.CompletionItemKind.Property);
                        const def = entry.default === undefined ? "" : ` (default: ${JSON.stringify(entry.default)})`;
                        item.detail = `${entry.type ?? "setting"}${def}`;
                        if (typeof entry.description === "string" && entry.description.length > 0) {
                            item.documentation = entry.description;
                        }
                        return item;
                    });
                },
            },
            '"',
        ),
    );
}
