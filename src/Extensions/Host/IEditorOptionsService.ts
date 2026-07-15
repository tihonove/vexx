/**
 * Снимок настроек редактора, относящихся к indent. В Phase 1 — только
 * `tabSize`/`insertSpaces`. По мере реализации API сюда добавятся другие
 * `TextEditorOptions` (например, `cursorStyle`, `lineNumbers`).
 */
export interface IEditorOptionsState {
    readonly tabSize: number;
    readonly insertSpaces: boolean;
}

export interface IEditorOptionsPatch {
    readonly tabSize?: number;
    readonly insertSpaces?: boolean;
}

/**
 * Метаданные активного редактора, проецируемые в subprocess на смене фокуса
 * (`editor.activeEditorChanged`). Только метаданные — без текста (полный снапшот
 * приходит лишь на пути will-save, WP6).
 */
export interface IActiveEditorMeta {
    /** Ресурс активного документа как `uri.toString()`; `null` — активного редактора нет. */
    readonly uri: string | null;
    readonly languageId: string | null;
    readonly isDirty: boolean;
}

import type { IDisposable } from "../../Common/Disposable.ts";

/**
 * Тонкий «port» поверх {@link EditorGroupController}, нужный
 * {@link ExtensionHost} для применения изменений `TextEditor.options`
 * к активному редактору без прямого знания о слое Controllers/Editor
 * внутри runtime'а расширения.
 */
export interface IEditorOptionsService {
    getActiveEditorOptions(): IEditorOptionsState | null;
    setActiveEditorOptions(patch: IEditorOptionsPatch): void;
    getActiveEditorFilePath(): string | null;
    /** Метаданные активного редактора для проекции в subprocess. */
    getActiveEditorMeta(): IActiveEditorMeta;
    onActiveEditorChanged(cb: (meta: IActiveEditorMeta) => void): IDisposable;
}
