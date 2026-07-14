import type { EndOfLine } from "../vs/editor/common/core/endOfLine.ts";
import type { IRange } from "../vs/editor/common/core/range.ts";

/**
 * Снапшот документа, передаваемый save-участнику (`onWillSaveTextDocument`)
 * перед записью на диск. Текст — LF-канонический (как хранит {@link TextDocument}),
 * EOL применяется отдельным эдитом (`kind: "eol"`).
 */
export interface ISaveSnapshot {
    /** Абсолютный путь сохраняемого файла. */
    readonly fileName: string;
    readonly languageId: string;
    readonly versionId: number;
    readonly isDirty: boolean;
    /** Полный текст документа (LF-канонический). */
    readonly text: string;
    /**
     * Текущий EOL документа (детектированный при загрузке / изменённый ранее).
     * Нужен участнику, чтобы решить, менять ли перевод строки: стоковый
     * editorconfig-vscode эмитит `setEndOfLine` только когда `doc.eol` отличается
     * от целевого (иначе no-op, сохраняя redo-историю).
     */
    readonly eol: EndOfLine;
}

/**
 * Правка, возвращаемая save-участником. Либо замена текста в диапазоне
 * (`kind: "text"`, координаты 0-based), либо смена EOL всего документа
 * (`kind: "eol"`).
 */
export type ISaveEdit =
    | { readonly kind: "text"; readonly range: IRange; readonly text: string }
    | { readonly kind: "eol"; readonly eol: EndOfLine };

/**
 * Save-участник: по снапшоту документа возвращает набор правок, которые
 * редактор применяет к буферу (undoable) непосредственно перед записью на диск.
 * Инъектируется в {@link EditorController} извне (host/харнесс) — ядро не знает
 * про extension-слой. Пустой результат = сохранить как есть.
 */
export type SaveParticipant = (snapshot: ISaveSnapshot) => Promise<readonly ISaveEdit[]>;
