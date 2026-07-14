/**
 * Represents a foldable region in a text document.
 * startLine is the first line of the region (the "header" line, always visible).
 * endLine is the last line of the region (inclusive).
 * When collapsed, lines from startLine+1 to endLine are hidden.
 */
export interface IFoldingRegion {
    startLine: number;
    endLine: number;
    isCollapsed: boolean;
}

export function createFoldingRegion(startLine: number, endLine: number, isCollapsed = false): IFoldingRegion {
    return { startLine, endLine, isCollapsed };
}
