import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { EditorGroupController } from "../Controllers/EditorGroupController.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { EditorOptionsServiceAdapter } from "../Extensions/Host/EditorOptionsServiceAdapter.ts";
import { ExtensionHost } from "../Extensions/Host/ExtensionHost.ts";
import type { IExtensionRegistration } from "../Extensions/Host/IExtensionEntry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { TestApp } from "./TestApp.ts";

export interface IExtensionHarnessOptions {
    readonly initialFile?: { readonly name: string; readonly content: string };
    readonly extensions?: readonly IExtensionRegistration[];
}

export interface IExtensionHarness {
    readonly app: TestApp;
    readonly host: ExtensionHost;
    readonly group: EditorGroupController;
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
export async function createExtensionTestHarness(
    options: IExtensionHarnessOptions = {},
): Promise<IExtensionHarness> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-ext-"));

    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const group = new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
    );
    group.mount();

    const adapter = new EditorOptionsServiceAdapter(group);
    const host = new ExtensionHost(adapter);

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
            await new Promise<void>((resolve) => queueMicrotask(resolve));
        }
    };

    for (const reg of options.extensions ?? []) {
        await host.registerExtension(reg);
        // Дожидаемся хотя бы одного RPC round-trip после активации.
        await flushRpc();
    }

    const dispose = async (): Promise<void> => {
        host.dispose();
        group.dispose();
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    };

    return { app, host, group, tmpDir, writeFile, flushRpc, dispose };
}
