import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
import { CommandRegistry } from "../Controllers/CommandRegistry.ts";
import { EditorGroupController } from "../Controllers/EditorGroupController.ts";
import { UndoRedoService } from "../Controllers/Workspace/UndoRedoService.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { CommandServiceAdapter } from "../Extensions/Host/CommandServiceAdapter.ts";
import { EditorOptionsServiceAdapter } from "../Extensions/Host/EditorOptionsServiceAdapter.ts";
import { ExtensionHost, type IExtensionHostConfigProvider } from "../Extensions/Host/ExtensionHost.ts";
import type { IExtensionRegistration } from "../Extensions/Host/IExtensionEntry.ts";

const SUBPROCESS_ENTRY = fileURLToPath(new URL("../Extensions/Host/__fixtures__/subprocessEntry.ts", import.meta.url));

/**
 * Возвращает `spawnArgs`-фабрику для тестового запуска subprocess'а — вместо
 * `main.ts` запускает {@link SUBPROCESS_ENTRY} через `tsx` loader. Это нужно,
 * т.к. в vitest `process.argv[1]` указывает на vitest CLI, а не на `main.ts`.
 */
export function subprocessSpawnArgsForTests(): () => { command: string; args: string[]; env?: NodeJS.ProcessEnv } {
    return () => ({
        command: process.execPath,
        args: ["--import", "tsx/esm", SUBPROCESS_ENTRY],
        env: { ...process.env },
    });
}
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { TestApp } from "./TestApp.ts";

export interface IExtensionHarnessOptions {
    readonly initialFile?: { readonly name: string; readonly content: string };
    readonly extensions?: readonly IExtensionRegistration[];
    /**
     * Снапшот конфигурации, который host запушит в subprocess
     * (`workspace.initialize`). Читается расширением через `getConfiguration`.
     */
    readonly configuration?: unknown;
    /**
     * Пути папок воркспейса (`workspace.workspaceFolders`). По умолчанию — tmpDir.
     */
    readonly workspaceFolders?: readonly string[];
    /**
     * Сервис определения языка (для `document.languageId`). По умолчанию —
     * {@link NULL_LANGUAGE_SERVICE} (всё — `plaintext`).
     */
    readonly languageService?: ILanguageService;
}

export interface IExtensionHarness {
    readonly app: TestApp;
    readonly host: ExtensionHost;
    readonly group: EditorGroupController;
    /**
     * Host-реестр команд, за которым стоит {@link ExtensionHost}. Тест может
     * `execute(...)` прокси-команду сабпроцесса (host → subprocess) или
     * `register(...)` хостовую команду, которую сабпроцесс вызовет fall-through.
     */
    readonly commandRegistry: CommandRegistry;
    readonly tmpDir: string;
    writeFile(name: string, content: string): string;
    /**
     * Прокачивает microtask-очередь — RPC в Phase 1 идёт через `queueMicrotask`,
     * один полный round-trip = два «оборота» (request → handler → response).
     */
    flushRpc(turns?: number): Promise<void>;
    dispose(): Promise<void>;
}

/**
 * Test harness для расширений: поднимает реальный {@link EditorGroupController}
 * + {@link ExtensionHost}, оборачивает в {@link TestApp} (через body вокруг
 * `group.view`), опционально открывает файл и регистрирует расширения.
 *
 * Расширения регистрируются последовательно — каждый `registerExtension`
 * ждёт завершения `activate()` и RPC-вызовов внутри него.
 */
export async function createExtensionTestHarness(options: IExtensionHarnessOptions = {}): Promise<IExtensionHarness> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-ext-"));

    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const group = new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        options.languageService ?? NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
    );
    group.mount();

    const adapter = new EditorOptionsServiceAdapter(group);
    const commandRegistry = new CommandRegistry();
    const commandAdapter = new CommandServiceAdapter(commandRegistry);
    const folders = (options.workspaceFolders ?? [tmpDir]).map((p, index) => ({
        uri: p,
        name: path.basename(p),
        index,
    }));
    const configuration: IExtensionHostConfigProvider = {
        getSnapshot: () => options.configuration,
        getWorkspaceFolders: () => folders,
        onDidChange: () => ({ dispose: () => undefined }),
    };
    const host = new ExtensionHost(adapter, commandAdapter, {
        spawnArgs: subprocessSpawnArgsForTests(),
        configuration,
    });

    // Save-pipeline (WP6): проброс will-save/did-save между группой и хостом.
    group.saveParticipant = (snapshot) => host.willSaveTextDocument(snapshot);
    group.onEditorSaved((meta) => host.didSaveTextDocument(meta));

    const writeFile = (name: string, content: string): string => {
        const fp = path.join(tmpDir, name);
        fs.writeFileSync(fp, content, "utf-8");
        return fp;
    };

    if (options.initialFile !== undefined) {
        const fp = writeFile(options.initialFile.name, options.initialFile.content);
        group.openFile(fp);
    }

    const app = TestApp.createWithContent(group.view);

    const flushRpc = async (turns = 2): Promise<void> => {
        for (let i = 0; i < turns; i++) {
            await new Promise<void>((resolve) => {
                queueMicrotask(resolve);
            });
        }
    };

    for (const reg of options.extensions ?? []) {
        await host.registerExtension(reg);
    }

    const dispose = async (): Promise<void> => {
        host.dispose();
        // ExtensionHost.dispose стартует асинхронный shutdownSubprocess(); ждём
        // короткое окно, чтобы дать ему успеть отправить host.shutdown и
        // дочерний процесс корректно завершился.
        await new Promise((resolve) => setTimeout(resolve, 100));
        group.dispose();
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    };

    return { app, host, group, commandRegistry, tmpDir, writeFile, flushRpc, dispose };
}
