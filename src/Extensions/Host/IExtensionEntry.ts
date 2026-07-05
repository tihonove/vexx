/**
 * Контракт CJS-модуля расширения, как его ждёт `runExtensionHostSubprocess`.
 *
 * Сигнатура канонически совпадает с VS Code: `activate(context)`. Внутри
 * расширение получает API через `require("vscode")` — мы стабим этот модуль
 * в subprocess'е через `Module._cache` + `_resolveFilename` patch.
 */
export interface IExtensionEntry {
    activate(context: { readonly subscriptions: { dispose(): unknown }[] }): unknown;
    deactivate?(): unknown;
}

/**
 * Регистрация расширения в {@link ExtensionHost}. Host форкает subprocess,
 * отправляет ему `mainPath` и просит загрузить через `createRequire`. Поэтому
 * `mainPath` ДОЛЖЕН быть абсолютным путём к JS-файлу, который subprocess
 * сможет открыть на своей файловой системе (для SEA это значит — реальный
 * файл вне бандла; builtin-расширения с `main` пока не поддерживаются).
 */
export interface IExtensionRegistration {
    readonly id: string;
    readonly manifest: {
        readonly name: string;
        readonly publisher: string;
        readonly version: string;
        readonly [key: string]: unknown;
    };
    readonly mainPath: string;
    /**
     * Дефолты из `contributes.configuration` расширения, сплюснутые в dotted-map
     * (`{ "editorconfig.generateAuto": true }`). Отправляются в subprocess в
     * `host.activateExtension` и слоятся под пользовательским снапшотом настроек.
     */
    readonly configDefaults?: Readonly<Record<string, unknown>>;
}
