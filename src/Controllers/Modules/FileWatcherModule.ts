import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ChokidarFileWatcher } from "../ChokidarFileWatcher.ts";
import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { IFileWatcherDIToken } from "../IFileWatcherDIToken.ts";

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
