import type { IGutterChangeDecoration } from "../../Editor/Decorations/IGutterChangeDecoration.ts";

/**
 * Тонкий «port» поверх {@link EditorGroupController}, нужный {@link ExtensionHost}
 * для проекции gutter change-bar декораций расширения на открытые редакторы без
 * прямого знания о слое Controllers/Editor внутри host-моста.
 *
 * Цвета приходят уже резолвнутыми (packed-RGB) — тема резолвится на стороне
 * host'а через {@link IThemeColorResolver}. Паттерн повторяет
 * {@link IEditorOptionsService}: адаптер живёт в слое Extensions, ядро про host
 * ничего не знает.
 */
export interface IEditorDecorationsService {
    /**
     * Проставляет полный набор gutter change-bar декораций для файла (по всем
     * открытым редакторам этого ресурса). Пустой массив снимает их.
     */
    setGutterChangeDecorations(fileName: string, decorations: readonly IGutterChangeDecoration[]): void;
}

/** No-op реализация — для тестов/профилей без моста декораций. */
export const NULL_EDITOR_DECORATIONS_SERVICE: IEditorDecorationsService = {
    setGutterChangeDecorations: () => undefined,
};
