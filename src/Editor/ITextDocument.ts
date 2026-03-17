import type { ITextEdit } from "./ITextEdit.ts";
import type { ILineTokens } from "./ILineTokens.ts";
import type { IRange } from "./IRange.ts";

export interface IApplyEditsResult {
    readonly appliedVersion: number;
    readonly inverseEdits: readonly ITextEdit[];
}

/**
 * Read/write interface for a text document.
 * Line indices are 0-based.
 */
export interface ITextDocument {
    readonly lineCount: number;
    readonly versionId: number;

    getLineContent(lineIndex: number): string;
    getLineLength(lineIndex: number): number;
    getText(): string;
    getTextInRange(range: IRange): string;

    applyEdits(edits: readonly ITextEdit[]): IApplyEditsResult;

    getLineTokens(lineIndex: number): ILineTokens | undefined;
    setLineTokens(lineIndex: number, tokens: ILineTokens): void;
}
