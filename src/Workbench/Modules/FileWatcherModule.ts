import type { ContainerModule } from "../../Common/DiContainer.ts";
import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { ChokidarFileWatcher } from "../Services/ChokidarFileWatcher.ts";
import { IFileWatcherDIToken } from "../Services/IFileWatcherDIToken.ts";

/**
 * Продакшен: реальный watcher поверх chokidar. Следит за открытыми файлами и
 * сигналит контроллеру о внешних изменениях.
 */
export const fileWatcherModule: ContainerModule = (container) => {
    container.bind(IFileWatcherDIToken, () => new ChokidarFileWatcher());
};

/** Тесты/дефолт: no-op watcher (live-watch выключен, если фейк не подставлен). */
export const fileWatcherModuleDefault: ContainerModule = (container) => {
    container.bind(IFileWatcherDIToken, () => NULL_FILE_WATCHER);
};
