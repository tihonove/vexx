import type { IPosition } from "./IPosition.ts";
import { createPosition, comparePositions } from "./IPosition.ts";

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

export function isRangeEmpty(range: IRange): boolean {
    return range.start.line === range.end.line && range.start.character === range.end.character;
}

export function rangeContainsPosition(range: IRange, position: IPosition): boolean {
    if (comparePositions(position, range.start) < 0) {
        return false;
    }
    if (comparePositions(position, range.end) > 0) {
        return false;
    }
    return true;
}
