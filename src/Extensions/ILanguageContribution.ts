/**
 * Описание языка из `package.json` → `contributes.languages[]`
 * расширения VS Code. Формат идентичен оригинальному манифесту, чтобы
 * можно было копировать апстрим-расширения verbatim.
 *
 * Все пути (`configuration`, `icon.*`) — **относительные** к каталогу
 * расширения (`IExtension.location`).
 */
export interface ILanguageContribution {
    /** Уникальный идентификатор языка (`"typescript"`, `"javascript"`). */
    readonly id: string;

    /**
     * Алиасы (для UI, language picker). Первый элемент — display name.
     * Пустой массив = язык не показывается в picker.
     */
    readonly aliases?: readonly string[];

    /** Расширения файлов в формате `".ts"`, `".tsx"`. */
    readonly extensions?: readonly string[];

    /** Точные имена файлов (`"Makefile"`, `"jakefile"`). */
    readonly filenames?: readonly string[];

    /** Glob-паттерны имён файлов (`"tsconfig.*.json"`). */
    readonly filenamePatterns?: readonly string[];

    /** Регэксп для match по первой строке (например shebang). */
    readonly firstLine?: string;

    /** MIME-типы. */
    readonly mimetypes?: readonly string[];

    /**
     * Относительный путь к `language-configuration.json`
     * (brackets, comments, autoClosingPairs и т.д.).
     * Phase 1: типизируется и копируется, но не применяется.
     */
    readonly configuration?: string;

    /**
     * Иконка языка для file explorer. Не используется в Phase 1.
     */
    readonly icon?: {
        readonly light: string;
        readonly dark: string;
    };
}
