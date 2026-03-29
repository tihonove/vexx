import type { ILineTokens } from "./ILineTokens.ts";
import type { IRange } from "./IRange.ts";
import type { ITextEdit } from "./ITextEdit.ts";

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
    setText(text: string): void;
    getTextInRange(range: IRange): string;

    applyEdits(edits: readonly ITextEdit[]): IApplyEditsResult;

    getLineTokens(lineIndex: number): ILineTokens | undefined;
    setLineTokens(lineIndex: number, tokens: ILineTokens): void;
}
