import type { IGrammarContribution } from "./IGrammarContribution.ts";
import type { ILanguageContribution } from "./ILanguageContribution.ts";

/**
 * Полный VS Code-совместимый extension manifest (`package.json` расширения).
 *
 * В Phase 1 загрузчик читает только {@link IExtensionContributions.languages}
 * и {@link IExtensionContributions.grammars}. Остальные contributes-блоки
 * объявлены ниже как **закомментированные** TS-типы — они задокументированы,
 * но не активны, чтобы расширения, копируемые из VS Code, не падали по
 * типам, и чтобы было ясно, какие поля будут добавлены в будущем.
 */
export interface IExtensionManifest {
    /** Технический id (нижний регистр, без пробелов). */
    readonly name: string;

    /** Локализуемое отображаемое имя (`"%displayName%"` или строка). */
    readonly displayName?: string;

    /** Локализуемое описание. */
    readonly description?: string;

    /** Semver. */
    readonly version: string;

    /** Издатель. Пара `publisher.name` формирует extension id. */
    readonly publisher: string;

    /** Engine compatibility. Phase 1: не валидируется. */
    readonly engines: {
        readonly vscode: string;
        readonly node?: string;
    };

    /**
     * Точка входа — JS-модуль, исполняемый Extension Host'ом.
     * **Phase 1: НЕ исполняется.** Все contributions декларативные.
     */
    readonly main?: string;

    /** Браузерный entry point. Phase 1: не исполняется. */
    readonly browser?: string;

    /**
     * События активации (`onLanguage:typescript`, `onCommand:foo`, `*`, ...).
     * Phase 1: lazy activation отсутствует, всё активно сразу.
     */
    readonly activationEvents?: readonly string[];

    /** "ui" | "workspace" — где может работать. Не используется. */
    readonly extensionKind?: readonly ("ui" | "workspace" | "web")[];

    readonly extensionDependencies?: readonly string[];
    readonly extensionPack?: readonly string[];

    readonly contributes?: IExtensionContributions;

    readonly repository?: {
        readonly type: string;
        readonly url: string;
    };

    readonly categories?: readonly string[];
    readonly keywords?: readonly string[];
    readonly icon?: string;
    readonly license?: string;
    readonly author?: string | { readonly name: string };
    readonly homepage?: string;
    readonly bugs?: string | { readonly url?: string; readonly email?: string };

    /**
     * Произвольные поля типа `scripts`, `dependencies`, `devDependencies`
     * из обычного `package.json`. Игнорируются нашим loader'ом, но не должны
     * ломать парсинг.
     */
    readonly [key: string]: unknown;
}

/**
 * Все contributes из VS Code. **Активны только `languages` и `grammars`.**
 * Остальные блоки оставлены закомментированными типами для будущих фаз.
 */
export interface IExtensionContributions {
    readonly languages?: readonly ILanguageContribution[];
    readonly grammars?: readonly IGrammarContribution[];

    // ── TODO(extensions phase 2+): раскомментировать по мере реализации ──
    //
    // readonly themes?: readonly IThemeContribution[];
    // readonly iconThemes?: readonly IIconThemeContribution[];
    // readonly productIconThemes?: readonly IProductIconThemeContribution[];
    //
    // readonly commands?: readonly ICommandContribution[];
    // readonly keybindings?: readonly IKeybindingContribution[];
    // readonly menus?: Readonly<Record<string, readonly IMenuItemContribution[]>>;
    // readonly submenus?: readonly ISubmenuContribution[];
    //
    // readonly snippets?: readonly ISnippetContribution[];
    //
    // readonly configuration?: IConfigurationContribution | readonly IConfigurationContribution[];
    // readonly configurationDefaults?: Readonly<Record<string, unknown>>;
    //
    // readonly views?: Readonly<Record<string, readonly IViewContribution[]>>;
    // readonly viewsContainers?: Readonly<Record<string, readonly IViewContainerContribution[]>>;
    // readonly viewsWelcome?: readonly IViewWelcomeContribution[];
    //
    // readonly colors?: readonly IColorContribution[];
    //
    // readonly debuggers?: readonly IDebuggerContribution[];
    // readonly breakpoints?: readonly IBreakpointContribution[];
    // readonly taskDefinitions?: readonly ITaskDefinitionContribution[];
    // readonly problemMatchers?: readonly IProblemMatcherContribution[];
    // readonly problemPatterns?: readonly IProblemPatternContribution[];
    //
    // readonly jsonValidation?: readonly IJsonValidationContribution[];
    //
    // readonly terminal?: ITerminalContribution;
    // readonly walkthroughs?: readonly IWalkthroughContribution[];
    //
    // readonly notebooks?: readonly INotebookContribution[];
    // readonly notebookRenderer?: readonly INotebookRendererContribution[];
    //
    // readonly customEditors?: readonly ICustomEditorContribution[];
    // readonly authentication?: readonly IAuthenticationContribution[];
    // readonly resourceLabelFormatters?: readonly IResourceLabelFormatterContribution[];
    //
    // readonly semanticTokenScopes?: readonly ISemanticTokenScopeContribution[];
    // readonly semanticTokenTypes?: readonly ISemanticTokenTypeContribution[];
    // readonly semanticTokenModifiers?: readonly ISemanticTokenModifierContribution[];
    //
    // readonly typescriptServerPlugins?: readonly ITypescriptServerPluginContribution[];
    // readonly htmlLanguageParticipants?: readonly IHtmlLanguageParticipantContribution[];

    /** Расширения VS Code иногда содержат поля, неизвестные нам. Игнорируем. */
    readonly [key: string]: unknown;
}
