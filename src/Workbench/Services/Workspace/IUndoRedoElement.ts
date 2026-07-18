/**
 * Один отменяемый шаг в общей истории workspace (à la VS Code `IUndoRedoElement`).
 * Охватывает и текстовые правки (через путь-ресурс), и файловые операции.
 */
export interface IUndoRedoElement {
    /** Человекочитаемая метка операции ("Delete", "Move", "Paste", "Typing", …). */
    readonly label: string;
    /**
     * Пути, которых касается операция (для информации/будущей инвалидации). Это НЕ
     * ключ истории: бакет задаётся отдельным аргументом `pushElement(element, context)`.
     * У безымянного буфера пуст — пути на диске ещё нет.
     */
    readonly resources: readonly string[];
    /**
     * Если задано — отмена этого шага деструктивна (например, удалит созданные вставкой
     * файлы); строка — текст подтверждения для пользователя. Гейтится `explorer.confirmUndo`.
     */
    readonly confirmBeforeUndo?: string;
    undo(): void | Promise<void>;
    redo(): void | Promise<void>;
}
