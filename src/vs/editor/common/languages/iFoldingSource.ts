import type { IFoldingRegion } from "../../contrib/folding/iFoldingRegion.ts";

/**
 * Запрос областей сворачивания к folding-источнику. Несёт полный снапшот текста
 * документа (у хоста нет реестра документов — как и в completion/will-save,
 * снапшот передаётся целиком).
 */
export interface IFoldingRequest {
    /** Ресурс активного документа как `uri.toString()`. */
    readonly uri: string;
    readonly languageId: string;
    /** Полный текст документа (LF-канонический). */
    readonly text: string;
}

/**
 * Folding-источник: по запросу возвращает области сворачивания от провайдеров
 * расширений (`languages.registerFoldingRangeProvider`). Инъектируется в ядро
 * извне (host/харнесс) — ядро не знает про extension-слой (зеркало
 * {@link ./iCompletionSource.ts:CompletionSource}). Пустой результат = провайдер
 * ничего не дал; ядро откатывается на indentation-фолды.
 */
export type FoldingRangeSource = (request: IFoldingRequest) => Promise<readonly IFoldingRegion[]>;
