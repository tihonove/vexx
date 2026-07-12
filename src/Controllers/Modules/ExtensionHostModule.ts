import * as path from "node:path";

import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { IDisposable } from "../../Common/Disposable.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { LogLevel } from "../../Common/Logging/LogLevel.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import { createRange } from "../../Editor/IRange.ts";
import type { IMarkerData } from "../../Editor/Markers/IMarker.ts";
import { MarkerSeverity } from "../../Editor/Markers/IMarker.ts";
import { CommandServiceAdapter } from "../../Extensions/Host/CommandServiceAdapter.ts";
import { EditorOptionsServiceAdapter } from "../../Extensions/Host/EditorOptionsServiceAdapter.ts";
import {
    ExtensionHost,
    ExtensionHostDIToken,
    type IDocumentSyncSnapshot,
    type IExtensionHostConfigProvider,
    type IHostDiagnostic,
} from "../../Extensions/Host/ExtensionHost.ts";
import { CommandRegistryDIToken } from "../CommandRegistry.ts";
import { MarkerServiceDIToken } from "../CoreTokens.ts";
import type { EditorController } from "../EditorController.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

/** SPIKE (LSP): `vscode.DiagnosticSeverity` (0..3) → `MarkerSeverity`. */
function toMarkerSeverity(severity: number): MarkerSeverity {
    switch (severity) {
        case 1:
            return MarkerSeverity.Warning;
        case 2:
            return MarkerSeverity.Info;
        case 3:
            return MarkerSeverity.Hint;
        default:
            return MarkerSeverity.Error;
    }
}

/**
 * DI-модуль extension host'а. Связывает `EditorGroupController` →
 * `IEditorOptionsService` → `ExtensionHost`. В production хост создаётся
 * пустым (без зарегистрированных расширений) — `main` builtin-расширений
 * пока не исполняется; всё подключение идёт в тестах через харнесс.
 *
 * SPIKE (LSP): дополнительно проводит (а) сток диагностик расширений в
 * `MarkerService` (→ squiggle + панель Problems) и (б) core→host document sync
 * (`editor.didOpen`/`didChange`), нужный стоковому `vscode-languageclient`.
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
        // Для NULL_LOG_SERVICE все уровни отключены — не переключаем stdio в "pipe".
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

        // SPIKE (LSP): сток диагностик → MarkerService (squiggle + Problems).
        const markerService = container.get(MarkerServiceDIToken);
        const diagnosticsSink = (owner: string, resource: string, markers: readonly IHostDiagnostic[]): void => {
            const data: IMarkerData[] = markers.map((m) => ({
                severity: toMarkerSeverity(m.severity),
                range: createRange(m.startLine, m.startCharacter, m.endLine, m.endCharacter),
                message: m.message,
                ...(m.code !== undefined ? { code: m.code } : {}),
                ...(m.source !== undefined ? { source: m.source } : {}),
            }));
            markerService.changeOne(owner, resource, data);
        };

        // SPIKE (LSP): снимок активного документа для sync-push.
        let docVersion = 0;
        const snapshotOf = (editor: EditorController | null): IDocumentSyncSnapshot | null => {
            const filePath = editor?.absoluteFilePath ?? null;
            if (editor === null || filePath === null) return null;
            docVersion += 1;
            return { fileName: filePath, languageId: editor.languageId, version: docVersion, text: editor.getText() };
        };

        const host = new ExtensionHost(adapter, commandAdapter, {
            logger,
            rpcLogger,
            stdoutLogger: wantStdio(stdoutLogger),
            stderrLogger: wantStdio(stderrLogger),
            configuration,
            diagnosticsSink,
            activeDocumentProvider: () => snapshotOf(group.getActiveEditor()),
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

        // SPIKE (LSP): document sync — didOpen на смену активного редактора,
        // didChange на правку его содержимого (стоковый languageclient дедупит
        // повторный didOpen по uri, поэтому лишние open'ы безопасны).
        let contentSub: IDisposable | null = null;
        const bindActive = (editor: EditorController | null): void => {
            contentSub?.dispose();
            contentSub = null;
            const openSnap = snapshotOf(editor);
            if (openSnap !== null) host.didOpenTextDocument(openSnap);
            if (editor !== null) {
                contentSub = editor.onDidChangeContent(() => {
                    const changeSnap = snapshotOf(editor);
                    if (changeSnap !== null) host.didChangeTextDocument(changeSnap);
                });
            }
        };
        group.onActiveEditorChanged(bindActive);
        bindActive(group.getActiveEditor());

        return host;
    });
};
