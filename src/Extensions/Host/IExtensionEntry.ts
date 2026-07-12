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
 * `mainPath` ДОЛЖЕН быть абсолютным путём к файлу, который subprocess сможет
 * `require` на своей ФС (в dev — `.ts`/`.cjs`, транспилируется tsx). Builtin-
 * расширения с `main` регистрируются в `main.ts` через `collectBuiltinMainSpecs`
 * + `resolveBuiltinDir()` (в dev — реальный каталог `src/Extensions/builtin/`).
 * Под SEA builtin-файлы живут в бандле — extract-on-run отложен (Task 7).
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
    /**
     * Заголовки команд из `contributes.commands` (`{ "EditorConfig.generate":
     * "Generate .editorconfig" }`). Когда расширение регистрирует одноимённую
     * команду в рантайме, host заводит прокси с этим title — и команда
     * появляется в палитре.
     */
    readonly commandTitles?: Readonly<Record<string, string>>;
}
