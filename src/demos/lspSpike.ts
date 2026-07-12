/**
 * SPIKE-раннер (см. plan LSP-spike). Поднимает НАСТОЯЩИЙ ExtensionHost через
 * тест-харнесс, регистрирует стоковое-подобное расширение
 * `startsLanguageClient.cjs`, которое стоковым `vscode-languageclient` спавнит
 * `typescript-language-server`. Цель — позырить, взлетит ли сервер и отдаст ли
 * что-то, и оценить масштаб интервенции в наш `vscode`-стаб.
 *
 * Запуск: `npm run spike:lsp`. Логи `[spike] ...` идут из сабпроцесса (host в
 * inherit-режиме) прямо в этот терминал.
 */
import * as path from "node:path";

import {
    createExtensionTestHarness,
    EXTENSION_FIXTURES_DIR,
    extensionFixture,
} from "../TestUtils/ExtensionTestHarness.ts";

async function main(): Promise<void> {
    const sampleDir = path.join(EXTENSION_FIXTURES_DIR, "lspSample");
    console.log("[spike] sample workspace:", sampleDir);

    const harness = await createExtensionTestHarness({
        workspaceFolders: [sampleDir],
        extensions: [extensionFixture("spike.lsp", "startsLanguageClient.cjs")],
    });

    // Активация фикстуры (registerExtension) уже дождалась client.start() +
    // definition внутри activate(); дадим маленький буфер на дренаж логов.
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("[spike] disposing host (kills language server)…");
    await harness.dispose();
    console.log("[spike] done.");
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error("[spike] FAILED:", err);
        process.exit(1);
    },
);
