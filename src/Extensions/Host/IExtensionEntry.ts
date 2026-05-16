import type * as vscode from "vscode";

/**
 * Контракт точки входа расширения.
 *
 * В оригинальном VS Code сигнатура — `activate(context)`, а `vscode`
 * импортируется через `import * as vscode from "vscode"`. В Phase 1, пока
 * extension host исполняется in-process, мы передаём `vscode` вторым
 * аргументом (компромисс — раскручивать виртуальный модуль `"vscode"` ради
 * in-process MVP не хочется). При переходе на self-spawn в дочернем процессе
 * мы стабим `"vscode"` через `Module._cache` и сигнатура вернётся к
 * каноническому виду.
 *
 * Фикстуры могут использовать `import type * as vscode from "vscode"` для
 * типизации — `tsconfig paths` укажет на `src/Extensions/Api/vscode.d.ts`.
 */
export interface IExtensionEntry {
    activate(context: vscode.ExtensionContext, api: typeof vscode): void | Promise<void>;
    deactivate?(): void | Promise<void>;
}

/**
 * Регистрация расширения для in-process хоста: id + манифест + entry-модуль.
 * При переходе на self-spawn `entry` уступит место `manifest.main` + path.
 */
export interface IExtensionRegistration {
    readonly id: string;
    readonly manifest: {
        readonly name: string;
        readonly publisher: string;
        readonly version: string;
        // прочие поля манифеста игнорируем в Phase 1
        readonly [key: string]: unknown;
    };
    readonly entry: IExtensionEntry;
}
