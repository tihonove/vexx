import type { IPosition } from "./IPosition.ts";
import type { IRange } from "./IRange.ts";
import { createPosition, comparePositions, positionsEqual } from "./IPosition.ts";

/**
 * Represents a selection in a text document.
 * anchor — where the selection started, active — where the cursor currently is.
 * When collapsed (anchor === active), this is just a cursor position.
 *
 * idealColumn — "remembered" column for vertical navigation.
 * When undefined, it equals active.character.
 */
export interface ISelection {
    readonly anchor: IPosition;
    readonly active: IPosition;
    readonly idealColumn?: number;
}

export function createSelection(
    anchorLine: number,
    anchorCharacter: number,
    activeLine: number,
    activeCharacter: number,
    idealColumn?: number,
): ISelection {
    return {
        anchor: createPosition(anchorLine, anchorCharacter),
        active: createPosition(activeLine, activeCharacter),
        idealColumn,
    };
}

/**
 * Creates a collapsed selection (cursor with no selection range).
 */
export function createCursorSelection(line: number, character: number, idealColumn?: number): ISelection {
    const pos = createPosition(line, character);
    return { anchor: pos, active: pos, idealColumn };
}

/**
 * Returns the effective ideal column for a selection.
 * Falls back to active.character when idealColumn is not explicitly set.
 */
export function getIdealColumn(selection: ISelection): number {
    return selection.idealColumn ?? selection.active.character;
}

/**
 * Returns a new selection with the given idealColumn.
 */
export function withIdealColumn(selection: ISelection, idealColumn: number): ISelection {
    return { anchor: selection.anchor, active: selection.active, idealColumn };
}

export function isSelectionCollapsed(selection: ISelection): boolean {
    return positionsEqual(selection.anchor, selection.active);
}

/**
 * Normalizes a selection into a range where start <= end.
 */
export function selectionToRange(selection: ISelection): IRange {
    if (comparePositions(selection.anchor, selection.active) <= 0) {
        return { start: selection.anchor, end: selection.active };
    }
    return { start: selection.active, end: selection.anchor };
}
