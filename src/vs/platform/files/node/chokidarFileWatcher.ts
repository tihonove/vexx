import chokidar from "chokidar";

import type { IDisposable } from "../../../base/common/disposable.ts";
import type { IFileWatcher } from "../common/iFileWatcher.ts";

/**
 * Реальная реализация {@link IFileWatcher} поверх chokidar (та же зависимость,
 * что и в дереве файлов). Следит за одним файлом; любое событие (`change`,
 * `add` после атомарного save-by-rename, `unlink`) прокидывается в `onChange`.
 *
 * Дебаунсит всплеск событий (атомарная запись = unlink+add за пару миллисекунд),
 * чтобы потребитель перечитал диск один раз, а не на каждый чих.
 */
export class ChokidarFileWatcher implements IFileWatcher {
    public watchFile(filePath: string, onChange: () => void): IDisposable {
        const watcher = chokidar.watch(filePath, { ignoreInitial: true });
        let timer: ReturnType<typeof setTimeout> | null = null;

        const notify = (): void => {
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                onChange();
            }, 50);
        };

        watcher.on("change", notify);
        watcher.on("add", notify);
        watcher.on("unlink", notify);

        return {
            dispose: () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
                void watcher.close();
            },
        };
    }
}
