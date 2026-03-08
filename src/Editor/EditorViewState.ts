import type { ITextDocument } from "./ITextDocument.ts";
import type { ISelection } from "./ISelection.ts";
import type { IPosition } from "./IPosition.ts";
import type { ITextEdit } from "./ITextEdit.ts";
import { createPosition, comparePositions } from "./IPosition.ts";
import { createCursorSelection, selectionToRange } from "./ISelection.ts";
import { createTextEdit } from "./ITextEdit.ts";
import { createRange } from "./IRange.ts";

/**
 * Represents the view state for one editor pane.
 * Multiple EditorViewStates can reference the same ITextDocument (split view).
 */
export class EditorViewState {
    public scrollLeft = 0;
    public scrollTop = 0;
    public selections: ISelection[];

    constructor(
        public readonly document: ITextDocument,
        selections?: ISelection[],
    ) {
        this.selections = selections && selections.length > 0 ? selections : [createCursorSelection(0, 0)];
    }

    /**
     * Types text at every cursor/selection.
     * If a selection is non-collapsed, the selected text is replaced.
     */
    type(text: string): void {
        const edits = this.buildEditsFromSelections(text);
        this.document.applyEdits(edits);
        this.selections = this.computeSelectionsAfterEdits(edits);
    }

    /**
     * Inserts a newline at every cursor.
     */
    insertNewLine(): void {
        this.type("\n");
    }

    /**
     * Deletes one character to the left of each cursor, or deletes the selection.
     */
    deleteLeft(): void {
        const edits: ITextEdit[] = [];

        for (const sel of this.sortedSelections()) {
            const range = selectionToRange(sel);
            if (range.start.line === range.end.line && range.start.character === range.end.character) {
                // Collapsed: expand one char left
                const pos = sel.active;
                if (pos.character > 0) {
                    edits.push(createTextEdit(createRange(pos.line, pos.character - 1, pos.line, pos.character), ""));
                } else if (pos.line > 0) {
                    const prevLineLen = this.document.getLineLength(pos.line - 1);
                    edits.push(createTextEdit(createRange(pos.line - 1, prevLineLen, pos.line, 0), ""));
                }
            } else {
                edits.push(createTextEdit(range, ""));
            }
        }

        if (edits.length > 0) {
            this.document.applyEdits(edits);
            this.selections = this.computeSelectionsAfterEdits(edits);
        }
    }

    /**
     * Deletes one character to the right of each cursor, or deletes the selection.
     */
    deleteRight(): void {
        const edits: ITextEdit[] = [];

        for (const sel of this.sortedSelections()) {
            const range = selectionToRange(sel);
            if (range.start.line === range.end.line && range.start.character === range.end.character) {
                // Collapsed: expand one char right
                const pos = sel.active;
                const lineLen = this.document.getLineLength(pos.line);
                if (pos.character < lineLen) {
                    edits.push(createTextEdit(createRange(pos.line, pos.character, pos.line, pos.character + 1), ""));
                } else if (pos.line < this.document.lineCount - 1) {
                    edits.push(createTextEdit(createRange(pos.line, lineLen, pos.line + 1, 0), ""));
                }
            } else {
                edits.push(createTextEdit(range, ""));
            }
        }

        if (edits.length > 0) {
            this.document.applyEdits(edits);
            this.selections = this.computeSelectionsAfterEdits(edits);
        }
    }

    // ─── Private ────────────────────────────────────────────

    /**
     * Returns selections sorted by position in document order.
     */
    private sortedSelections(): ISelection[] {
        return [...this.selections].sort((a, b) => {
            const rangeA = selectionToRange(a);
            const rangeB = selectionToRange(b);
            return comparePositions(rangeA.start, rangeB.start);
        });
    }

    /**
     * Builds text edits from all current selections.
     */
    private buildEditsFromSelections(text: string): ITextEdit[] {
        return this.sortedSelections().map((sel) => {
            const range = selectionToRange(sel);
            return createTextEdit(range, text);
        });
    }

    /**
     * After edits are applied, computes the new cursor positions.
     * Each cursor moves to the end of the inserted text.
     */
    private computeSelectionsAfterEdits(edits: ITextEdit[]): ISelection[] {
        // Sort edits in document order (ascending)
        const sorted = [...edits].sort((a, b) => comparePositions(a.range.start, b.range.start));

        const newSelections: ISelection[] = [];
        let accLineDelta = 0;
        let accCharDelta = 0;
        let lastEditEndLine = -1;

        for (const edit of sorted) {
            const range = edit.range;
            const insertedLines = edit.text.split("\n");
            const insertedLineCount = insertedLines.length;

            // End position of the inserted text
            let newLine: number;
            let newChar: number;

            if (insertedLineCount === 1) {
                // Single-line insert: cursor goes to start + text length
                newLine = range.start.line + accLineDelta;
                const startChar =
                    range.start.line === lastEditEndLine ? range.start.character + accCharDelta : range.start.character;
                newChar = startChar + insertedLines[0].length;
            } else {
                // Multi-line insert: cursor goes to the last inserted line
                newLine = range.start.line + accLineDelta + insertedLineCount - 1;
                newChar = insertedLines[insertedLineCount - 1].length;
            }

            newSelections.push(createCursorSelection(newLine, newChar));

            // Update accumulated deltas
            const deletedLines = range.end.line - range.start.line;
            const lineDelta = insertedLineCount - 1 - deletedLines;
            accLineDelta += lineDelta;

            if (insertedLineCount === 1 && deletedLines === 0) {
                // Same-line edit: accumulate character delta
                const charDelta = insertedLines[0].length - (range.end.character - range.start.character);
                if (range.start.line === lastEditEndLine) {
                    accCharDelta += charDelta;
                } else {
                    accCharDelta = charDelta;
                }
                lastEditEndLine = range.start.line;
            } else {
                accCharDelta = 0;
                lastEditEndLine = -1;
            }
        }

        return newSelections.length > 0 ? newSelections : [createCursorSelection(0, 0)];
    }
}
