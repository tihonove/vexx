import type { IRange } from "./IRange.ts";
import { createRange } from "./IRange.ts";

/**
 * Represents a single text edit operation.
 * Replaces text in `range` with `text`. Empty `text` = deletion. Empty range = insertion.
 */
export interface ITextEdit {
    readonly range: IRange;
    readonly text: string;
}

export function createTextEdit(range: IRange, text: string): ITextEdit {
    return { range, text };
}

export function createInsertEdit(line: number, character: number, text: string): ITextEdit {
    return {
        range: createRange(line, character, line, character),
        text,
    };
}

export function createDeleteEdit(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
): ITextEdit {
    return {
        range: createRange(startLine, startCharacter, endLine, endCharacter),
        text: "",
    };
}
