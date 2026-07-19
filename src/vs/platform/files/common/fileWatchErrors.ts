/**
 * Разбор ошибок файловых watcher'ов в человекочитаемый вид.
 *
 * Самый частый случай на Linux — исчерпан лимит inotify (`ENOSPC`) или лимит
 * открытых дескрипторов (`EMFILE`): ОС отказывает в новом watch'е, chokidar
 * делает `emit('error')`. Пользователю в такой ситуации нужна не трасса, а
 * рецепт — VS Code в этом месте показывает уведомление с подсказкой поднять
 * `fs.inotify.max_user_watches`. Пока уведомлений нет, тот же текст уходит в лог
 * (см. `docs/TODO/EnvironmentTuning.md`).
 */

/** Коды ошибок, означающие «упёрлись в лимит ОС на количество watch'ей». */
const WATCH_LIMIT_CODES = new Set(["ENOSPC", "EMFILE"]);

export interface FileWatchErrorInfo {
    /** errno-код ошибки, если он есть (`ENOSPC`, `EMFILE`, `EACCES`, …). */
    readonly code: string | undefined;
    /** Упёрлись ли в лимит ОС на watch'и — по такой ошибке имеет смысл советовать тюнинг. */
    readonly isWatchLimit: boolean;
    /** Готовая подсказка-суффикс для сообщения (пустая строка, если советовать нечего). */
    readonly hint: string;
}

export function describeFileWatchError(error: unknown): FileWatchErrorInfo {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    const isWatchLimit = code !== undefined && WATCH_LIMIT_CODES.has(code);
    return {
        code,
        isWatchLimit,
        hint: isWatchLimit ? " — inotify watch limit reached; increase fs.inotify.max_user_watches" : "",
    };
}
