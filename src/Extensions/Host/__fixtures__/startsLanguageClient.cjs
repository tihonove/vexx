"use strict";

/**
 * SPIKE-фикстура (см. docs/plan LSP-spike). Стоковый паттерн LSP-расширения:
 * поднимает настоящий `vscode-languageclient`, который сам спавнит
 * `typescript-language-server` и гоняет JSON-RPC. Мы лишь предоставляем
 * `vscode` API (наш стаб) — фикстура НИЧЕГО из протокола не реализует сама.
 *
 * Логи `[spike] ...` летят в stdout сабпроцесса (host в inherit-режиме) —
 * видно прямо в терминале драйвера `npm run spike:lsp`.
 */

const fs = require("node:fs");
const path = require("node:path");

// Позиция вызова `greet(...)` в lspSample/main.ts (0-based): строка
// `console.log(greet("world"));` — символ 14 внутри `greet`. go-to-def должен
// уехать кросс-файлово в defs.ts.
const SPIKE_POSITION = { line: 2, character: 14 };

exports.activate = async function activate(context) {
    const { LanguageClient } = require("vscode-languageclient/node");

    const serverModule = require.resolve("typescript-language-server/lib/cli.mjs");
    const serverOptions = {
        command: process.execPath,
        args: [serverModule, "--stdio"],
    };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "typescript" }],
    };

    const client = new LanguageClient("vexxTsSpike", "TS Spike", serverOptions, clientOptions);
    context.subscriptions.push(client);

    console.log("[spike] starting language client…");
    await client.start();
    const caps = client.initializeResult && client.initializeResult.capabilities;
    console.log("[spike] server initialized. definitionProvider =", JSON.stringify(caps && caps.definitionProvider));

    // «Отдаст ли что-то»: сырой didOpen обоих файлов проекта + textDocument/definition.
    const dir = path.join(__dirname, "lspSample");
    const open = (name) => {
        const f = path.join(dir, name);
        client.sendNotification("textDocument/didOpen", {
            textDocument: { uri: "file://" + f, languageId: "typescript", version: 1, text: fs.readFileSync(f, "utf8") },
        });
    };
    open("defs.ts");
    open("main.ts");
    // Дадим tsserver собрать программу перед запросом (кросс-файловый резолв).
    await new Promise((r) => setTimeout(r, 1500));

    const loc = await client.sendRequest("textDocument/definition", {
        textDocument: { uri: "file://" + path.join(dir, "main.ts") },
        position: SPIKE_POSITION,
    });
    console.log("[spike] definition →", JSON.stringify(loc));
};
