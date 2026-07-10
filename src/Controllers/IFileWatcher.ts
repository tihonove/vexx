import { token } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

/**
 * Наблюдатель за отдельными файлами на диске. Абстрагирует реальный
 * файловый watcher (chokidar/fs.watch) от контроллеров, чтобы логику
 * «файл поменялся снаружи» можно было гонять в юнит-тестах детерминированно
 * (через фейк, который триггерит колбэк вручную).
 *
 * Единственная реализация с реальным IO — {@link ChokidarFileWatcher}; в тестах
 * используется {@link NULL_FILE_WATCHER} или ручной фейк.
 */
export interface IFileWatcher {
    /**
     * Начинает следить за одним файлом. `onChange` вызывается, когда файл на
     * диске изменился/пересоздан/удалён (без разбора — потребитель сам решает,
     * что делать, сверяясь со stat). Возвращает disposable для остановки.
     */
    watchFile(filePath: string, onChange: () => void): IDisposable;
}

export const IFileWatcherDIToken = token<IFileWatcher>("IFileWatcher");

/** No-op наблюдатель: ничего не отслеживает (тесты, окружения без live-watch). */
export const NULL_FILE_WATCHER: IFileWatcher = {
    watchFile(): IDisposable {
        return { dispose: () => {} };
    },
};
