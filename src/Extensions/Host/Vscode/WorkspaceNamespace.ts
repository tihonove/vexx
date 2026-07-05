import type * as vscode from "vscode";

import type { ExtHostTextDocument } from "./ExtHostDocuments.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl, EventEmitter, Uri } from "./VscodeTypes.ts";

/** Папка воркспейса, полученная из `workspace.initialize`. */
interface IWorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
    readonly index: number;
}

/** Wire-форма папки (host → subprocess). */
interface IWireWorkspaceFolder {
    readonly uri: string;
    readonly name: string;
    readonly index: number;
}

/**
 * `vscode.workspace` на стороне subprocess.
 *
 * Конфигурация приходит push-моделью в {@link IVscodeHostContext.configStore}
 * через notif'ы `workspace.initialize` / `workspace.configurationChanged`
 * (см. host). `getConfiguration().get()` синхронный — читает из уже полученного
 * снапшота. Регистрация save-слушателей шлёт `workspace.updateSubscriptions`
 * на переходах 0↔1 (исполнение will-save — WP6).
 */
export function createWorkspaceNamespace(ctx: IVscodeHostContext): typeof vscode.workspace {
    const { rpc, registry, configStore } = ctx;

    let workspaceFolders: IWorkspaceFolder[] = [];

    const onDidChangeConfigurationEmitter = new EventEmitter<vscode.ConfigurationChangeEvent>();
    const onDidOpenTextDocumentEmitter = new EventEmitter<vscode.TextDocument>();
    const onDidCloseTextDocumentEmitter = new EventEmitter<vscode.TextDocument>();
    const onWillSaveTextDocumentEmitter = new EventEmitter<vscode.TextDocumentWillSaveEvent>();
    const onDidSaveTextDocumentEmitter = new EventEmitter<vscode.TextDocument>();

    // Счётчики слушателей save-событий: subprocess сообщает хосту (updateSubscriptions),
    // нужно ли вообще запускать pipeline will/did-save.
    let willSaveCount = 0;
    let didSaveCount = 0;
    function pushSubscriptions(): void {
        rpc.notify("workspace.updateSubscriptions", {
            willSave: willSaveCount > 0,
            didSave: didSaveCount > 0,
        });
    }

    rpc.handleNotification("workspace.initialize", (params) => {
        const p = params as { configuration?: unknown; workspaceFolders?: IWireWorkspaceFolder[] };
        configStore.setSnapshot(p.configuration);
        workspaceFolders = (p.workspaceFolders ?? []).map((f) => ({
            uri: Uri.file(f.uri),
            name: f.name,
            index: f.index,
        }));
    });

    rpc.handleNotification("workspace.configurationChanged", (params) => {
        const p = params as { configuration?: unknown; affectedKeys?: string[] };
        configStore.setSnapshot(p.configuration);
        const affectedKeys = p.affectedKeys ?? [];
        onDidChangeConfigurationEmitter.fire({
            affectsConfiguration: (section: string): boolean =>
                affectedKeys.some((key) => key === section || key.startsWith(section + ".")),
        } as vscode.ConfigurationChangeEvent);
    });

    function getConfiguration(section?: string, _scope?: unknown): vscode.WorkspaceConfiguration {
        const prefix = section !== undefined && section !== "" ? section + "." : "";
        const config: Record<string, unknown> = {
            get: (key: string, defaultValue?: unknown): unknown => configStore.get(prefix + key, defaultValue),
            has: (key: string): boolean => configStore.has(prefix + key),
            inspect: (key: string) => {
                const r = configStore.inspect(prefix + key);
                return {
                    key: r.key,
                    defaultValue: r.defaultValue,
                    globalValue: r.globalValue,
                    workspaceValue: undefined,
                    workspaceFolderValue: undefined,
                };
            },
            update: (key: string): Thenable<void> => {
                rpc.notify("window.showMessage", {
                    severity: "warn",
                    message: `workspace.getConfiguration().update("${prefix + key}") is not supported`,
                });
                return Promise.resolve();
            },
        };
        // VS Code выставляет значения секции как поля объекта конфигурации.
        for (const key of configStore.sectionKeys(section)) {
            if (key in config) continue; // не затираем get/has/inspect/update
            config[key] = configStore.get(prefix + key);
        }
        return config as unknown as vscode.WorkspaceConfiguration;
    }

    function asRelativePath(pathOrUri: string | vscode.Uri, includeWorkspaceFolder?: boolean): string {
        const p = typeof pathOrUri === "string" ? pathOrUri : (pathOrUri as unknown as Uri).fsPath;
        for (const folder of workspaceFolders) {
            const root = folder.uri.fsPath;
            if (p === root || p.startsWith(root + "/")) {
                const rel = p.slice(root.length).replace(/^\/+/, "");
                if (rel === "") return p;
                return includeWorkspaceFolder === true && workspaceFolders.length > 1
                    ? folder.name + "/" + rel
                    : rel;
            }
        }
        return p;
    }

    function openTextDocument(uriOrPath: vscode.Uri | string): Thenable<vscode.TextDocument> {
        const fsPath =
            typeof uriOrPath === "string" ? uriOrPath : (uriOrPath as unknown as Uri).fsPath;
        const doc = registry.get(fsPath);
        if (doc !== undefined) return Promise.resolve(doc as unknown as vscode.TextDocument);
        // Чтение с диска в эфемерный документ — WP7. Пока graceful reject.
        return Promise.reject(new Error(`openTextDocument: "${fsPath}" is not an open document`));
    }

    const workspaceNs = {
        get workspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
            return workspaceFolders.length === 0
                ? undefined
                : (workspaceFolders as unknown as readonly vscode.WorkspaceFolder[]);
        },

        get name(): string | undefined {
            return workspaceFolders[0]?.name;
        },

        get textDocuments(): readonly vscode.TextDocument[] {
            return registry.all() as unknown as readonly vscode.TextDocument[];
        },

        getConfiguration,
        asRelativePath,
        openTextDocument,

        onDidChangeConfiguration: onDidChangeConfigurationEmitter.event,
        onDidOpenTextDocument: onDidOpenTextDocumentEmitter.event,
        onDidCloseTextDocument: onDidCloseTextDocumentEmitter.event,

        onWillSaveTextDocument: (
            listener: (e: vscode.TextDocumentWillSaveEvent) => unknown,
            thisArgs?: unknown,
            disposables?: vscode.Disposable[],
        ): vscode.Disposable => {
            // Внутреннюю подписку регистрируем без `disposables` — в массив кладём
            // wrapper, чтобы dispose через него корректно уменьшал счётчик.
            const inner = onWillSaveTextDocumentEmitter.event(listener as never, thisArgs);
            willSaveCount++;
            if (willSaveCount === 1) pushSubscriptions();
            const wrapper = new DisposableImpl(() => {
                inner.dispose();
                willSaveCount--;
                if (willSaveCount === 0) pushSubscriptions();
            }) as unknown as vscode.Disposable;
            if (disposables !== undefined) disposables.push(wrapper);
            return wrapper;
        },

        onDidSaveTextDocument: (
            listener: (e: vscode.TextDocument) => unknown,
            thisArgs?: unknown,
            disposables?: vscode.Disposable[],
        ): vscode.Disposable => {
            const inner = onDidSaveTextDocumentEmitter.event(listener as never, thisArgs);
            didSaveCount++;
            if (didSaveCount === 1) pushSubscriptions();
            const wrapper = new DisposableImpl(() => {
                inner.dispose();
                didSaveCount--;
                if (didSaveCount === 0) pushSubscriptions();
            }) as unknown as vscode.Disposable;
            if (disposables !== undefined) disposables.push(wrapper);
            return wrapper;
        },
    };

    return workspaceNs as unknown as typeof vscode.workspace;
}
