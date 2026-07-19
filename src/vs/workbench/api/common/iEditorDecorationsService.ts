import type { IGutterChangeDecoration } from "../../../editor/common/model/iGutterChangeDecoration.ts";

/**
 * Тонкий «port» поверх {@link EditorService}, нужный {@link ExtensionHost}
 * для проекции gutter change-bar декораций расширения на открытые редакторы без
 * прямого знания о слоях Workbench/Editor внутри host-моста.
 *
 * Цвета приходят уже резолвнутыми (packed-RGB) — тема резолвится на стороне
 * host'а через {@link IThemeColorResolver}. Паттерн повторяет
 * {@link IEditorOptionsService}: адаптер живёт в слое Extensions, ядро про host
 * ничего не знает.
 */
export interface IEditorDecorationsService {
    /**
     * Проставляет полный набор gutter change-bar декораций для ресурса (по всем
     * открытым редакторам этого ресурса). Пустой массив снимает их.
     *
     * `uri` — ресурс как `uri.toString()`, а не путь на диске.
     */
    setGutterChangeDecorations(uri: string, decorations: readonly IGutterChangeDecoration[]): void;
}

/** No-op реализация — для тестов/профилей без моста декораций. */
export const NULL_EDITOR_DECORATIONS_SERVICE: IEditorDecorationsService = {
    setGutterChangeDecorations: () => undefined,
};
