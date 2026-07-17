// Модель тасков и проблем-матчеров — VS Code-совместимая подсхема.
//
// Держим ровно то, что нужно первому срезу (one-shot shell/process-таски + one-shot
// problem matcher). Схема паттернов/матчеров — дословно как в builtin-манифестах
// (`src/Extensions/builtin/{scss,less,cpp}/package.json`, поля `problemPatterns`/
// `problemMatchers`), чтобы позже подключить матчеры из расширений без реформы модели.

/**
 * Один паттерн проблемы: регэксп + индексы capture-групп, по которым собираем маркер.
 * Индексы 1-based (группа 0 — весь матч), как в VS Code.
 */
export interface IProblemPattern {
    /** Регэксп в виде строки (компилируем сами; без флага `g`). */
    readonly regexp: string;
    /** Группа с путём файла. */
    readonly file?: number;
    /**
     * Группа с «локацией» — компактная запись `line`, `line,col`,
     * `line,col,endLine,endCol` (VS Code `kind: "location"`). Разбирается, только
     * если не заданы явные `line`/`column`.
     */
    readonly location?: number;
    readonly line?: number;
    readonly column?: number;
    readonly endLine?: number;
    readonly endColumn?: number;
    /** Группа с severity-словом (`error`/`warning`/`info`). */
    readonly severity?: number;
    /** Группа с машинным кодом (например `TS2322`). */
    readonly code?: number;
    /** Группа с текстом сообщения (обязательна на последнем паттерне). */
    readonly message?: number;
    /**
     * Последний паттерн многострочной цепочки может «зацикливаться»: пока строки
     * ему соответствуют, каждая порождает отдельный маркер под общим заголовком.
     */
    readonly loop?: boolean;
}

/**
 * Как резолвить путь из матча в ресурс:
 * - `"absolute"` — путь уже абсолютный;
 * - `"relative"` — относительно папки воркспейса;
 * - `["relative", base]` / `["absolute", base]` — относительно указанной базы
 *   (`${workspaceFolder}` подставляем сами).
 */
export type FileLocation = "absolute" | "relative" | "autoDetect" | readonly [string, string];

export interface IProblemMatcher {
    /** Неймспейс поставщика в `MarkerService` (`"typescript"`, `"gcc"`, …). */
    readonly owner: string;
    /** Человекочитаемый ярлык источника (кладём в `IMarkerData.source`). */
    readonly source?: string;
    /** Дефолтная severity, если паттерн её не захватывает. */
    readonly severity?: "error" | "warning" | "info";
    readonly fileLocation: FileLocation;
    /** Один паттерн (однострочный) либо массив (многострочный матч). */
    readonly pattern: IProblemPattern | readonly IProblemPattern[];
}

/** Ссылка на матчер в таске: именованный (`"$tsc"`), inline-объект или их массив. */
export type ProblemMatcherRef = string | IProblemMatcher | readonly (string | IProblemMatcher)[];

export interface ITaskOptions {
    readonly cwd?: string;
    readonly env?: Record<string, string>;
}

export interface ITask {
    readonly label: string;
    /** `shell` — запуск через `sh -lc`; `process` — прямой запуск программы. */
    readonly type: "shell" | "process";
    readonly command: string;
    readonly args?: readonly string[];
    readonly options?: ITaskOptions;
    /** `group` VS Code: строка (`"build"`) или объект `{kind}` — нормализуем в строку. */
    readonly group?: string;
    readonly problemMatcher?: ProblemMatcherRef;
}
