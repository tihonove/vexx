import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { LogLevel } from "../../Common/Logging/LogLevel.ts";
import { CommandServiceAdapter } from "../../Extensions/Host/CommandServiceAdapter.ts";
import { EditorOptionsServiceAdapter } from "../../Extensions/Host/EditorOptionsServiceAdapter.ts";
import { ExtensionHost, ExtensionHostDIToken } from "../../Extensions/Host/ExtensionHost.ts";
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
        return new ExtensionHost(adapter, commandAdapter, {
            logger,
            rpcLogger,
            stdoutLogger: wantStdio(stdoutLogger),
            stderrLogger: wantStdio(stderrLogger),
        });
    });
};
