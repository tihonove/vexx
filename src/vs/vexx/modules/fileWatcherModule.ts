import type { ContainerModule } from "../../platform/instantiation/common/diContainer.ts";
import { NULL_FILE_WATCHER } from "../../platform/files/common/iFileWatcher.ts";
import { ChokidarFileWatcher } from "../../platform/files/node/chokidarFileWatcher.ts";
import { IFileWatcherDIToken } from "../../platform/files/common/iFileWatcherDIToken.ts";

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
