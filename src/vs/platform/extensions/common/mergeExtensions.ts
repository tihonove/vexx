import type { ILogger } from "../../log/common/logger.ts";

import type { IExtension } from "./extensions.ts";

/**
 * Сливает список builtin и user расширений в один массив, разруливая
 * конфликты id: при совпадении `IExtension.id` побеждает запись с
 * `isBuiltin: true`. О каждом конфликте пишется warning в переданный
 * `ILogger` — пользователь должен знать, что его внешнее расширение
 * перекрыто встроенным.
 *
 * Внутренние дубликаты в каждом списке: побеждает первая запись, остальные
 * пропускаются с warning. `logger` опционален — функция вызывается из
 * bootstrap-кода до создания DI-контейнера, поэтому зависимость инжектится
 * параметром, а не через DI.
 */
export function mergeExtensions(
    builtin: readonly IExtension[],
    user: readonly IExtension[],
    logger?: ILogger,
): IExtension[] {
    const byId = new Map<string, IExtension>();
    const seenInList = new Set<string>();

    for (const ext of builtin) {
        if (seenInList.has(ext.id)) {
            logger?.warn(`Duplicate builtin extension id "${ext.id}" — keeping the first occurrence`);
            continue;
        }
        seenInList.add(ext.id);
        byId.set(ext.id, ext);
    }

    seenInList.clear();
    for (const ext of user) {
        if (seenInList.has(ext.id)) {
            logger?.warn(`Duplicate user extension id "${ext.id}" — keeping the first occurrence`);
            continue;
        }
        seenInList.add(ext.id);
        if (byId.has(ext.id)) {
            logger?.warn(
                `User extension "${ext.id}" is shadowed by a builtin with the same id; ignoring the user copy`,
            );
            continue;
        }
        byId.set(ext.id, ext);
    }

    return [...byId.values()];
}
