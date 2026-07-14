import type { IStateDescriptor } from "../../platform/state/node/state.ts";

/**
 * Реестр дескрипторов машинного состояния — «инструкция», какие свойства у
 * каждого сохраняемого значения (ключ, scope, дефолт, версия). Параллель
 * `ContextKeys.ts`. Потребитель — {@link WorkbenchStateController}; движок и
 * правила — docs/arch/State.md.
 *
 * Scope по решению: всё состояние UI/сессии — **`workspace`** (по-проектно), с
 * fallback на `global`-стор, когда проект не открыт. Дефолты дублируют встроенные
 * значения `WorkbenchLayoutElement` (30 / 12), чтобы «нет сохранённого значения»
 * воспроизводило исходное поведение.
 */

/** Снимок открытых редакторов группы. */
export interface IOpenEditorsState {
    /** Абсолютные пути открытых файлов в позиционном порядке вкладок. */
    readonly files: readonly string[];
    /** Индекс активной вкладки в `files` (или -1, если группа пуста). */
    readonly activeIndex: number;
}

/** Ширина сайдбара (explorer) в колонках. */
export const SIDEBAR_WIDTH_STATE: IStateDescriptor<number> = {
    key: "workbench.sideBar.width",
    scope: "workspace",
    default: 30,
};

/** Видимость сайдбара. */
export const SIDEBAR_VISIBLE_STATE: IStateDescriptor<boolean> = {
    key: "workbench.sideBar.visible",
    scope: "workspace",
    default: true,
};

/** Видимость нижней панели (Problems/Output/…). */
export const PANEL_VISIBLE_STATE: IStateDescriptor<boolean> = {
    key: "workbench.panel.visible",
    scope: "workspace",
    default: false,
};

/** Высота нижней панели в строках. */
export const PANEL_HEIGHT_STATE: IStateDescriptor<number> = {
    key: "workbench.panel.height",
    scope: "workspace",
    default: 12,
};

/** Открытые файлы + активная вкладка. */
export const OPEN_EDITORS_STATE: IStateDescriptor<IOpenEditorsState> = {
    key: "workbench.editors.openEditors",
    scope: "workspace",
    default: { files: [], activeIndex: -1 },
};
