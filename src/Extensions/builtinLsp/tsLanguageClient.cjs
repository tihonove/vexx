"use strict";

/**
 * Встроенное (dev) расширение: поднимает `typescript-language-server` через стоковый
 * `vscode-languageclient`. Весь LSP-протокол, document-sync и publishDiagnostics
 * обслуживает сам languageclient; наша работа — только `vscode`-стаб. Диагностики
 * уходят в MarkerService через `languages.createDiagnosticCollection().set(...)` →
 * squiggle в редакторе + панель Problems.
 *
 * Регистрируется из `main.ts`. `VEXX_LSP_TRACE=1` включает verbose LSP-трассу в stdout.
 */
exports.activate = function activate(context) {
    const { LanguageClient, Trace } = require("vscode-languageclient/node");
    const traceEnabled = process.env.VEXX_LSP_TRACE === "1";
    const log = (m) => console.log("[lsp-trace]", typeof m === "string" ? m : JSON.stringify(m));
    const traceChannel = {
        name: "vexx-lsp-trace",
        logLevel: 1,
        onDidChangeLogLevel: () => ({ dispose() {} }),
        append() {},
        appendLine: log,
        replace() {},
        clear() {},
        show() {},
        hide() {},
        dispose() {},
        trace: log,
        debug: log,
        info: log,
        warn: log,
        error: log,
    };

    const serverModule = require.resolve("typescript-language-server/lib/cli.mjs");
    const serverOptions = {
        command: process.execPath,
        args: [serverModule, "--stdio"],
    };
    const clientOptions = {
        documentSelector: [
            { scheme: "file", language: "typescript" },
            { scheme: "file", language: "typescriptreact" },
            { scheme: "file", language: "javascript" },
            { scheme: "file", language: "javascriptreact" },
        ],
        ...(traceEnabled ? { traceOutputChannel: traceChannel, outputChannel: traceChannel } : {}),
    };

    const client = new LanguageClient("vexxTypescript", "TypeScript (Vexx)", serverOptions, clientOptions);
    context.subscriptions.push(client);
    // Fire-and-forget: активация не блокируется на initialize.
    client.start().then(
        () => {
            console.log("[vexx-lsp] typescript-language-server started");
            if (traceEnabled) void client.setTrace(Trace.Verbose);
        },
        (err) => console.error("[vexx-lsp] language client failed to start:", err && err.message),
    );
};
