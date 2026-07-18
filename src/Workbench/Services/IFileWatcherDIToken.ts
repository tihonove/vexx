import { token } from "../../Common/DiContainer.ts";
import type { IFileWatcher } from "../../Common/IFileWatcher.ts";

/**
 * DI-токен файлового watcher'а. Интерфейс {@link IFileWatcher} и no-op
 * `NULL_FILE_WATCHER` живут в Common (чистый IO-примитив); сам токен — здесь,
 * т.к. объявлять DI-токены можно только на уровнях Controllers/Workbench/App.
 */
export const IFileWatcherDIToken = token<IFileWatcher>("IFileWatcher");
