/**
 * Represents a position in a text document (0-based line and character).
 */
export interface IPosition {
    readonly line: number;
    readonly character: number;
}

export function createPosition(line: number, character: number): IPosition {
    return { line, character };
}

/**
 * Compares two positions. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function comparePositions(a: IPosition, b: IPosition): number {
    if (a.line !== b.line) {
        return a.line - b.line;
    }
    return a.character - b.character;
}

export function positionsEqual(a: IPosition, b: IPosition): boolean {
    return a.line === b.line && a.character === b.character;
}
