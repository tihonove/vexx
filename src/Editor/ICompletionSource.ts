import type { IRange } from "./IRange.ts";

/**
 * Запрос автодополнения, отправляемый completion-источнику. Несёт полный
 * снапшот текста + позицию курсора (у хоста нет реестра документов — как и в
 * will-save, снапшот передаётся целиком).
 */
export interface ICompletionRequest {
    /** Ресурс активного документа как `uri.toString()`. */
    readonly uri: string;
    readonly languageId: string;
    /** Полный текст документа (LF-канонический). */
    readonly text: string;
    /** Позиция курсора, 0-based. */
    readonly line: number;
    readonly character: number;
}

/**
 * Команда, привязанная к элементу автодополнения (`CompletionItem.command`).
 * После вставки исполняется через commands bridge (editorconfig использует это
 * для повторного `editor.action.triggerSuggest`).
 */
export interface ICoreCompletionCommand {
    readonly command: string;
    readonly arguments?: readonly unknown[];
}

/**
 * Элемент автодополнения в ядре (десериализованная форма расширенческого
 * `vscode.CompletionItem`). `insertText` уже нормализован (fallback на `label`
 * делает хост при сериализации).
 */
export interface ICoreCompletionItem {
    readonly label: string;
    readonly insertText: string;
    /** Числовой `CompletionItemKind` (значения enum VS Code 0…26). */
    readonly kind?: number;
    readonly detail?: string;
    readonly documentation?: string;
    readonly command?: ICoreCompletionCommand;
    /** Диапазон замены (если провайдер задал его явно); иначе ядро берёт префикс. */
    readonly range?: IRange;
    readonly sortText?: string;
    readonly filterText?: string;
}

/**
 * Completion-источник: по запросу возвращает элементы автодополнения от
 * провайдеров расширений. Инъектируется в ядро извне (host/харнесс) — ядро не
 * знает про extension-слой (зеркало {@link ./ISaveParticipant.ts:SaveParticipant}).
 * Пустой результат = автодополнений нет.
 */
export type CompletionSource = (request: ICompletionRequest) => Promise<readonly ICoreCompletionItem[]>;
