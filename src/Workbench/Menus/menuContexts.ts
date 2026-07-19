/**
 * Конвенции контекста открытия меню (`context` в `MenuRegistry.getMenuItems`):
 * - `MenuId.EditorContext`, меню-бар → `undefined`;
 * - `MenuId.ExplorerContext` → {@link ExplorerMenuContext}.
 *
 * Хелперы ниже используются в co-located размещениях экшенов
 * (`CommandAction.menus`) для резолва аргументов и императивной видимости.
 */
export interface ExplorerMenuContext {
    /** Путь выделенного узла дерева. */
    readonly path: string;
    /** Непустой буфер обмена файлов — видимость Paste. */
    readonly canPaste: boolean;
}

/** Аргумент команды Explorer — путь выделенного узла. */
export const explorerPathArg = (context: unknown): readonly unknown[] => [(context as ExplorerMenuContext).path];

/** Видимость Paste — непустой буфер обмена файлов (императивно, при открытии). */
export const explorerCanPaste = (context: unknown): boolean => (context as ExplorerMenuContext).canPaste;
