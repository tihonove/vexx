/**
 * Точки, куда контрибьютятся пункты меню (аналог `MenuId` в VS Code). Пункт
 * объявляет свой `menuId`, а сборщик меню (контекст-меню редактора/Explorer)
 * запрашивает `MenuRegistry.getMenuItems(menuId, …)`.
 */
export const MenuId = {
    EditorContext: "EditorContext",
    ExplorerContext: "ExplorerContext",
} as const;

export type MenuId = (typeof MenuId)[keyof typeof MenuId];
