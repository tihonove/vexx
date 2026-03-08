import type { ITextEdit } from "./ITextEdit.ts";
import type { ILineTokens } from "./ILineTokens.ts";

/**
 * Read/write interface for a text document.
 * Line indices are 0-based.
 */
export interface ITextDocument {
    readonly lineCount: number;

    getLineContent(lineIndex: number): string;
    getLineLength(lineIndex: number): number;
    getText(): string;

    applyEdits(edits: readonly ITextEdit[]): void;

    getLineTokens(lineIndex: number): ILineTokens | undefined;
    setLineTokens(lineIndex: number, tokens: ILineTokens): void;
}
