import type { IDisposable } from "../Common/Disposable.ts";

import type { IDocumentContentChange } from "./IDocumentContentChange.ts";
import type { IDocumentLanguageChange } from "./IDocumentLanguageChange.ts";
import type { IRange } from "./IRange.ts";
import type { ITextEdit } from "./ITextEdit.ts";

export interface IApplyEditsResult {
    readonly appliedVersion: number;
    readonly inverseEdits: readonly ITextEdit[];
}

/**
 * Read/write interface for a text document.
 * Line indices are 0-based.
 *
 * Token storage is intentionally NOT part of this interface; tokens live in
 * a separate per-document cache that subscribes to {@link onDidChangeContent}.
 */
export interface ITextDocument {
    readonly lineCount: number;
    readonly versionId: number;
    /** Language id документа (VS Code-стиль: `typescript`, `markdown`, …). */
    readonly languageId: string;

    getLineContent(lineIndex: number): string;
    getLineLength(lineIndex: number): number;
    getText(): string;
    setText(text: string): void;
    getTextInRange(range: IRange): string;

    applyEdits(edits: readonly ITextEdit[]): IApplyEditsResult;

    /**
     * Меняет язык документа. No-op при совпадении с текущим. Не меняет
     * `versionId` — смена языка не делает документ dirty.
     */
    setLanguage(languageId: string): void;

    /**
     * Notifies of any structural change (applyEdits / setText). Multiple
     * changes from a single `applyEdits` call are emitted one after another
     * in document order.
     */
    onDidChangeContent(listener: (change: IDocumentContentChange) => void): IDisposable;

    /** Notifies of a language change made via {@link setLanguage}. */
    onDidChangeLanguage(listener: (change: IDocumentLanguageChange) => void): IDisposable;
}
