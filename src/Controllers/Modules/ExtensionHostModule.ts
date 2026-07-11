import * as path from "node:path";

import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { LogLevel } from "../../Common/Logging/LogLevel.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import { CommandServiceAdapter } from "../../Extensions/Host/CommandServiceAdapter.ts";
import { EditorOptionsServiceAdapter } from "../../Extensions/Host/EditorOptionsServiceAdapter.ts";
import {
    ExtensionHost,
    ExtensionHostDIToken,
    type IExtensionHostConfigProvider,
} from "../../Extensions/Host/ExtensionHost.ts";
import { CommandRegistryDIToken } from "../CommandRegistry.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

/**
 * DI-модуль extension host'а. Связывает `EditorGroupController` →
 * `IEditorOptionsService` → `ExtensionHost`. В production хост создаётся
 * пустым (без зарегистрированных расширений) — `main` builtin-расширений
 * пока не исполняется; всё подключение идёт в тестах через харнесс.
 *
 * Логгеры (`extensions.host`, `extensions.host.rpc`, `.stdout`, `.stderr`)
 * берутся из `ILogService` — в тестах профиль использует `NULL_LOG_SERVICE`,
 * `isEnabled` всегда `false`, поэтому stdio остаётся в режиме `"inherit"`.
 */
export const extensionHostModule: ContainerModule = (container) => {
    container.bind(ExtensionHostDIToken, () => {
        const group = container.get(EditorGroupControllerDIToken);
        const adapter = new EditorOptionsServiceAdapter(group);
        const commandAdapter = new CommandServiceAdapter(container.get(CommandRegistryDIToken));
        const logService = container.get(ILogServiceDIToken);
        const logger = logService.createLogger("extensions.host");
        const rpcLogger = logService.createLogger("extensions.host.rpc");
        const stdoutLogger = logService.createLogger("extensions.host.stdout");
        const stderrLogger = logService.createLogger("extensions.host.stderr");
        // \u0414\u043b\u044f NULL_LOG_SERVICE \u0432\u0441\u0435 \u0443\u0440\u043e\u0432\u043d\u0438 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u044b \u2014 \u043d\u0435 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0430\u0435\u043c stdio \u0432 \"pipe\".
        const wantStdio = (lg: typeof stdoutLogger): typeof stdoutLogger | undefined =>
            lg.isEnabled(LogLevel.Info) ? lg : undefined;

        // Провайдер конфигурации: снапшот настроек + единственная папка воркспейса
        // (пока нет multi-root) из process.cwd(). Слой Configuration не тянется в
        // рантайм host'а — доступ идёт через этот тонкий адаптер.
        const configService = container.get(IConfigurationServiceDIToken);
        const cwd = process.cwd();
        const configuration: IExtensionHostConfigProvider = {
            getSnapshot: () => configService.getValue(),
            getWorkspaceFolders: () => [{ uri: cwd, name: path.basename(cwd), index: 0 }],
            onDidChange: (cb) =>
                configService.onDidChangeConfiguration((event) => {
                    cb(event.affectedKeys);
                }),
        };

        const host = new ExtensionHost(adapter, commandAdapter, {
            logger,
            rpcLogger,
            stdoutLogger: wantStdio(stdoutLogger),
            stderrLogger: wantStdio(stderrLogger),
            configuration,
        });

        // Save-pipeline: редакторы группы прогоняют will-save через host
        // (onWillSaveTextDocument), а состоявшееся сохранение уходит обратно
        // в subprocess (onDidSaveTextDocument).
        group.saveParticipant = (snapshot) => host.willSaveTextDocument(snapshot);
        group.onEditorSaved((meta) => {
            host.didSaveTextDocument(meta);
        });

        // Completion: провайдеры расширений (languages.provideCompletionItems)
        // подключаются как источник автодополнений группы (читает CompletionController).
        group.completionSource = (req) => host.provideCompletionItems(req);

        return host;
    });
};
