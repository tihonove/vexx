import * as nodeFs from "node:fs/promises";

import type * as vscode from "vscode";

import type { WireTextEdit } from "../WireTypes.ts";

import { ExtHostTextDocument } from "./ExtHostDocuments.ts";
import { createFileSystemNamespace } from "./FileSystemNamespace.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl, EndOfLine, EventEmitter, TextDocumentSaveReason, TextEdit, Uri } from "./VscodeTypes.ts";

/** Тайм-аут на один waitUntil-thenable участника will-save, мс. */
const WILL_SAVE_LISTENER_TIMEOUT_MS = 1500;

/** Промис, резолвящийся пустым набором правок по истечении per-listener тайм-аута. */
function listenerTimeout(): Promise<readonly TextEdit[]> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve([]), WILL_SAVE_LISTENER_TIMEOUT_MS);
        // Не держим event loop живым из-за таймера, который проиграл гонку.
        timer.unref?.();
    });
}

/** utf-8 — единственная реально поддерживаемая кодировка (ядро utf-8-only). */
function isUtf8(encoding: string): boolean {
    const normalized = encoding.toLowerCase().replace(/[-_]/g, "");
    return normalized === "utf8";
}

/**
 * Определяет преобладающий EOL в тексте (мажоритарно `\r\n` vs одиночный `\n`).
 * Ничьи и текст без переводов строк → LF. Совпадает с ядровой EOL-моделью WP5
 * (`src/Editor/EndOfLine.ts`), но локально — subprocess-поверхность `vscode`
 * держит свои value-типы без зависимости на `Editor`.
 */
function detectEndOfLine(text: string): EndOfLine {
    let crlf = 0;
    for (let i = text.indexOf("\r\n"); i !== -1; i = text.indexOf("\r\n", i + 2)) crlf++;
    let totalLf = 0;
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) totalLf++;
    return crlf > totalLf - crlf ? EndOfLine.CRLF : EndOfLine.LF;
}

/** Сериализует `vscode.TextEdit` в wire-форму (subprocess → host). */
function serializeTextEdit(edit: TextEdit): WireTextEdit {
    if (edit.newEol !== undefined) {
        return { setEndOfLine: edit.newEol === EndOfLine.CRLF ? 2 : 1 };
    }
    return {
        range: {
            startLine: edit.range.start.line,
            startCharacter: edit.range.start.character,
            endLine: edit.range.end.line,
            endCharacter: edit.range.end.character,
        },
        text: edit.newText,
    };
}

/** Wire-параметры запроса will-save (host → subprocess). */
interface IWireWillSaveParams {
    readonly fileName: string;
    readonly languageId?: string;
    readonly isDirty?: boolean;
    readonly text?: string;
    readonly reason?: number;
    /** `vscode.EndOfLine`: 1=LF, 2=CRLF. */
    readonly eol?: number;
}

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

    // Хост запрашивает pre-save правки: обновляем полный текст документа в
    // реестре, фаерим onWillSaveTextDocument, собираем waitUntil-thenable'ы (по
    // одному per-listener таймауту), сериализуем полученные TextEdit[].
    rpc.handleRequest("workspace.willSaveTextDocument", async (params): Promise<WireTextEdit[]> => {
        const p = params as IWireWillSaveParams;
        const doc = registry.upsertFull({
            fileName: p.fileName,
            languageId: p.languageId,
            isDirty: p.isDirty,
            text: p.text ?? "",
            ...(p.eol === 1 || p.eol === 2 ? { eol: p.eol } : {}),
        });
        const thenables: Thenable<readonly vscode.TextEdit[]>[] = [];
        let collecting = true;
        const event: vscode.TextDocumentWillSaveEvent = {
            document: doc as unknown as vscode.TextDocument,
            reason: (p.reason ?? TextDocumentSaveReason.Manual) as vscode.TextDocumentSaveReason,
            waitUntil: (thenable: Thenable<unknown>): void => {
                // waitUntil валиден только во время диспетча события (как в VS Code).
                if (collecting) thenables.push(Promise.resolve(thenable) as Thenable<readonly vscode.TextEdit[]>);
            },
        };
        onWillSaveTextDocumentEmitter.fire(event);
        collecting = false;

        const settled = await Promise.all(
            thenables.map((thenable) =>
                Promise.race([
                    Promise.resolve(thenable).catch(() => [] as readonly vscode.TextEdit[]),
                    listenerTimeout(),
                ]),
            ),
        );
        const edits: WireTextEdit[] = [];
        for (const result of settled) {
            if (!Array.isArray(result)) continue;
            for (const edit of result) {
                if (edit instanceof TextEdit) edits.push(serializeTextEdit(edit));
            }
        }
        return edits;
    });

    // Хост сообщил о состоявшемся сохранении — фаерим onDidSaveTextDocument.
    rpc.handleNotification("workspace.didSaveTextDocument", (params) => {
        const p = params as { fileName?: unknown; languageId?: unknown };
        if (typeof p.fileName !== "string") return;
        const doc = registry.upsertMeta({
            fileName: p.fileName,
            ...(typeof p.languageId === "string" ? { languageId: p.languageId } : {}),
        });
        onDidSaveTextDocumentEmitter.fire(doc as unknown as vscode.TextDocument);
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

    async function openTextDocument(
        uriOrPath: vscode.Uri | string,
        options?: { encoding?: string },
    ): Promise<vscode.TextDocument> {
        const fsPath =
            typeof uriOrPath === "string" ? uriOrPath : (uriOrPath as unknown as Uri).fsPath;
        // Открытый документ — отдаём стабильный объект из реестра.
        const open = registry.get(fsPath);
        if (open !== undefined) return open as unknown as vscode.TextDocument;

        // Промах реестра: читаем файл с диска в ЭФЕМЕРНЫЙ документ (в реестр не
        // кладём — это не открытый буфер). Ядро Vexx utf-8/LF-only, поэтому
        // encoding принимается, но фактически используется utf-8: при несовпадении
        // graceful degrade с предупреждением в лог хоста.
        const encoding = options?.encoding;
        if (encoding !== undefined && !isUtf8(encoding)) {
            rpc.notify("window.showMessage", {
                severity: "warn",
                message: `openTextDocument("${fsPath}"): encoding "${encoding}" is not supported, reading as utf-8`,
            });
        }
        const text = await nodeFs.readFile(fsPath, "utf8");
        const doc = new ExtHostTextDocument(fsPath);
        // EOL детектим из содержимого (в отличие от захардкоженного LF раньше);
        // encoding остаётся utf8 — реальное транскодирование зависит от charset
        // в ядре и вне объёма (ядро utf-8-only).
        doc.applyFull({ fileName: fsPath, text, eol: detectEndOfLine(text) });
        return doc as unknown as vscode.TextDocument;
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

        // workspace.fs — локальный доступ к диску через node:fs (без RPC).
        fs: createFileSystemNamespace(),

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
