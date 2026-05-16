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
 * Тонкий «port» поверх {@link EditorGroupController}, нужный
 * {@link ExtensionHost} для применения изменений `TextEditor.options`
 * к активному редактору без прямого знания о слое Controllers/Editor
 * внутри runtime'а расширения.
 */
export interface IEditorOptionsService {
    getActiveEditorOptions(): IEditorOptionsState | null;
    setActiveEditorOptions(patch: IEditorOptionsPatch): void;
}
