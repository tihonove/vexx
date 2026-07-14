/**
 * Описание TextMate-грамматики из `package.json` → `contributes.grammars[]`.
 * Формат идентичен оригинальному манифесту VS Code.
 */
export interface IGrammarContribution {
    /**
     * Идентификатор языка, к которому привязывается грамматика.
     * Если отсутствует — это injection-грамматика (см. `injectTo`).
     */
    readonly language?: string;

    /** Root scope грамматики (`"source.ts"`, `"source.css"`). */
    readonly scopeName: string;

    /** Относительный путь к `.tmLanguage.json` (или `.tmLanguage`/`.plist`). */
    readonly path: string;

    /**
     * Маппинг внутренних scope-имён к идентификаторам встроенных языков
     * (для embedded-фрагментов вроде `<script>` внутри HTML или JSX-tag
     * внутри source.tsx). Phase 1: данные сохраняются, но в TextMate-loader
     * не пробрасываются — embedded-tokenization появится позже.
     */
    readonly embeddedLanguages?: Readonly<Record<string, string>>;

    /**
     * Принудительная классификация токенов (override авто-классификации
     * vscode-textmate). Используется самим vscode-textmate и не затрагивает
     * наш рендер. Phase 1: сохраняется как есть.
     */
    readonly tokenTypes?: Readonly<Record<string, "string" | "comment" | "other">>;

    /**
     * Список scope-имён хост-грамматик, в которые встраивается данная
     * injection-грамматика. Поддерживается loader'ом в Phase 1.
     */
    readonly injectTo?: readonly string[];

    /**
     * Скоупы, для которых не нужно матчить парные скобки (используется
     * bracket pair colorizer в VS Code). Phase 1: не применяется.
     */
    readonly balancedBracketScopes?: readonly string[];
    readonly unbalancedBracketScopes?: readonly string[];
}
