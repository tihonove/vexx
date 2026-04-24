import type { IDisposable } from "../Common/Disposable.ts";

import type { IDocumentContentChange } from "./IDocumentContentChange.ts";
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

    getLineContent(lineIndex: number): string;
    getLineLength(lineIndex: number): number;
    getText(): string;
    setText(text: string): void;
    getTextInRange(range: IRange): string;

    applyEdits(edits: readonly ITextEdit[]): IApplyEditsResult;

    /**
     * Notifies of any structural change (applyEdits / setText). Multiple
     * changes from a single `applyEdits` call are emitted one after another
     * in document order.
     */
    onDidChangeContent(listener: (change: IDocumentContentChange) => void): IDisposable;
}
