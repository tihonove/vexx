import type { IPosition } from "./position.ts";
import { createPosition } from "./position.ts";

/**
 * Represents a range in a text document. start <= end (invariant).
 */
export interface IRange {
    readonly start: IPosition;
    readonly end: IPosition;
}

export function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): IRange {
    return {
        start: createPosition(startLine, startCharacter),
        end: createPosition(endLine, endCharacter),
    };
}
