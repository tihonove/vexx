import { token } from "../../instantiation/common/diContainer.ts";
import type { IFileWatcher } from "./iFileWatcher.ts";

/**
 * DI-токен файлового watcher'а. Интерфейс {@link IFileWatcher} и no-op
 * `NULL_FILE_WATCHER` живут в Common (чистый IO-примитив); сам токен — здесь,
 * т.к. объявлять DI-токены можно только на уровнях Workbench/App.
 */
export const IFileWatcherDIToken = token<IFileWatcher>("IFileWatcher");
