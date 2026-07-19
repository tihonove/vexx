/**
 * Payload события {@link ITextDocument.onDidChangeLanguage}.
 */
export interface IDocumentLanguageChange {
    readonly oldLanguageId: string;
    readonly newLanguageId: string;
}
