import type { IFoldingRegion } from "./IFoldingRegion.ts";
import type { ILineTokens } from "./ILineTokens.ts";
import { comparePositions } from "./IPosition.ts";
import { createRange } from "./IRange.ts";
import type { ISelection } from "./ISelection.ts";
import { createCursorSelection, createSelection, getIdealColumn, selectionToRange } from "./ISelection.ts";
import type { ITextDocument } from "./ITextDocument.ts";
import type { ITextEdit } from "./ITextEdit.ts";
import { createTextEdit } from "./ITextEdit.ts";
import type { IUndoElement } from "./IUndoElement.ts";

/**
 * Represents the view state for one editor pane.
 * Multiple EditorViewStates can reference the same ITextDocument (split view).
 *
 * Acts as a "lens" (projection) through which the renderer sees the TextDocument:
 * logical lines may differ from visual lines due to code folding.
 */
export class EditorViewState {
    public scrollLeft = 0;
    public scrollTop = 0;
    public viewportWidth = 80;
    public viewportHeight = 24;
    public selections: ISelection[];
    public readonly document: ITextDocument;
    public foldedRegions: IFoldingRegion[] = [];

    public constructor(document: ITextDocument, selections?: ISelection[]) {
        this.document = document;
        this.selections = selections && selections.length > 0 ? selections : [createCursorSelection(0, 0)];
    }

    // ─── Folding API ────────────────────────────────────────

    /**
     * Replaces the entire folding regions array.
     * Useful for external folding providers.
     */
    public setFoldingRegions(regions: IFoldingRegion[]): void {
        this.foldedRegions = regions;
    }

    /**
     * Toggles the collapsed state of the folding region whose startLine matches the given line.
     * No-op if no region starts at that line.
     */
    public toggleFold(line: number): void {
        for (const region of this.foldedRegions) {
            if (region.startLine === line) {
                region.isCollapsed = !region.isCollapsed;
                return;
            }
        }
    }

    /**
     * Collapses all folding regions.
     */
    public foldAll(): void {
        for (const region of this.foldedRegions) {
            region.isCollapsed = true;
        }
    }

    /**
     * Expands all folding regions.
     */
    public unfoldAll(): void {
        for (const region of this.foldedRegions) {
            region.isCollapsed = false;
        }
    }

    // ─── View API (projection for renderer) ─────────────────

    /**
     * Returns the number of visible lines (accounting for collapsed regions).
     */
    public getViewLineCount(): number {
        return this.buildVisibleLines().length;
    }

    /**
     * Returns the text content of a visual line.
     * The visualLineNumber is 0-based index into the visible lines array.
     */
    public getViewLine(visualLineNumber: number): string {
        const logicalLine = this.visualToLogicalLine(visualLineNumber);
        if (logicalLine < 0 || logicalLine >= this.document.lineCount) {
            return "";
        }
        return this.document.getLineContent(logicalLine);
    }

    /**
     * Returns tokens for a visual line.
     */
    public getViewLineTokens(visualLineNumber: number): ILineTokens | undefined {
        const logicalLine = this.visualToLogicalLine(visualLineNumber);
        if (logicalLine < 0 || logicalLine >= this.document.lineCount) {
            return undefined;
        }
        return this.document.getLineTokens(logicalLine);
    }

    // ─── Line Mapping ───────────────────────────────────────

    /**
     * Translates a logical (document) line number to a visual (screen) line number.
     * Returns -1 if the line is hidden inside a collapsed region.
     */
    public logicalToVisualLine(logicalLine: number): number {
        const visible = this.buildVisibleLines();
        const idx = visible.indexOf(logicalLine);
        return idx;
    }

    /**
     * Translates a visual (screen) line number to a logical (document) line number.
     * Returns -1 if the visual line is out of range.
     */
    public visualToLogicalLine(visualLine: number): number {
        const visible = this.buildVisibleLines();
        if (visualLine < 0 || visualLine >= visible.length) {
            return -1;
        }
        return visible[visualLine];
    }

    /**
     * Types text at every cursor/selection.
     * If a selection is non-collapsed, the selected text is replaced.
     */
    public type(text: string): IUndoElement {
        const beforeSelections = this.cloneSelections();
        const versionBefore = this.document.versionId;
        const edits = this.buildEditsFromSelections(text);
        const { appliedVersion, inverseEdits } = this.document.applyEdits(edits);
        this.adjustFoldingRegionsForEdits(edits);
        this.selections = this.computeSelectionsAfterEdits(edits);
        this.ensureCursorVisible();
        return {
            label: "type",
            versionBefore,
            versionAfter: appliedVersion,
            forwardEdits: edits,
            backwardEdits: inverseEdits,
            beforeSelections,
            afterSelections: this.cloneSelections(),
        };
    }

    /**
     * Inserts a newline at every cursor.
     */
    public insertNewLine(): void {
        this.type("\n");
    }

    /**
     * Deletes one character to the left of each cursor, or deletes the selection.
     */
    public deleteLeft(): IUndoElement | undefined {
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
            const beforeSelections = this.cloneSelections();
            const versionBefore = this.document.versionId;
            const { appliedVersion, inverseEdits } = this.document.applyEdits(edits);
            this.adjustFoldingRegionsForEdits(edits);
            this.selections = this.computeSelectionsAfterEdits(edits);
            this.ensureCursorVisible();
            return {
                label: "deleteLeft",
                versionBefore,
                versionAfter: appliedVersion,
                forwardEdits: edits,
                backwardEdits: inverseEdits,
                beforeSelections,
                afterSelections: this.cloneSelections(),
            };
        }

        return undefined;
    }

    // ─── Cursor Navigation ───────────────────────────────────

    /**
     * Moves each cursor one character to the left.
     * At the start of a line, wraps to the end of the previous visible line.
     * Updates idealColumn to the new activeColumn.
     */
    public cursorLeft(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            let newLine = pos.line;
            let newChar;

            if (pos.character > 0) {
                newChar = pos.character - 1;
            } else if (pos.line > 0) {
                const prevVisible = this.previousVisibleLine(pos.line);
                if (prevVisible >= 0) {
                    newLine = prevVisible;
                    newChar = this.document.getLineLength(prevVisible);
                } else {
                    return sel;
                }
            } else {
                return sel;
            }

            return this.buildSelection(sel, newLine, newChar, newChar, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor one character to the right.
     * At the end of a line, wraps to the start of the next visible line.
     * Updates idealColumn to the new activeColumn.
     */
    public cursorRight(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            const lineLen = this.document.getLineLength(pos.line);
            let newLine = pos.line;
            let newChar;

            if (pos.character < lineLen) {
                newChar = pos.character + 1;
            } else {
                const nextVisible = this.nextVisibleLine(pos.line);
                if (nextVisible >= 0) {
                    newLine = nextVisible;
                    newChar = 0;
                } else {
                    return sel;
                }
            }

            return this.buildSelection(sel, newLine, newChar, newChar, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor one visual line up.
     * Skips over collapsed folding regions.
     * Does NOT change idealColumn — vertical navigation preserves it.
     */
    public cursorUp(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            const prevVisible = this.previousVisibleLine(pos.line);
            if (prevVisible >= 0) {
                const ideal = getIdealColumn(sel);
                const targetLineLen = this.document.getLineLength(prevVisible);
                const newChar = Math.min(ideal, targetLineLen);
                return this.buildSelection(sel, prevVisible, newChar, ideal, inSelectionMode);
            }
            return sel;
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor one visual line down.
     * Skips over collapsed folding regions.
     * Does NOT change idealColumn — vertical navigation preserves it.
     */
    public cursorDown(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            const nextVisible = this.nextVisibleLine(pos.line);
            if (nextVisible >= 0) {
                const ideal = getIdealColumn(sel);
                const targetLineLen = this.document.getLineLength(nextVisible);
                const newChar = Math.min(ideal, targetLineLen);
                return this.buildSelection(sel, nextVisible, newChar, ideal, inSelectionMode);
            }
            return sel;
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor to the beginning of its line.
     * Sets idealColumn to 0 so subsequent Up/Down stay at column 0.
     */
    public cursorHome(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            return this.buildSelection(sel, sel.active.line, 0, 0, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor to the end of its line.
     * Sets idealColumn to MAX_SAFE_INTEGER so subsequent Up/Down "stick" to the right edge.
     */
    public cursorEnd(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const lineLen = this.document.getLineLength(sel.active.line);
            return this.buildSelection(sel, sel.active.line, lineLen, Number.MAX_SAFE_INTEGER, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Deletes one character to the right of each cursor, or deletes the selection.
     */
    public deleteRight(): IUndoElement | undefined {
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
            const beforeSelections = this.cloneSelections();
            const versionBefore = this.document.versionId;
            const { appliedVersion, inverseEdits } = this.document.applyEdits(edits);
            this.adjustFoldingRegionsForEdits(edits);
            this.selections = this.computeSelectionsAfterEdits(edits);
            this.ensureCursorVisible();
            return {
                label: "deleteRight",
                versionBefore,
                versionAfter: appliedVersion,
                forwardEdits: edits,
                backwardEdits: inverseEdits,
                beforeSelections,
                afterSelections: this.cloneSelections(),
            };
        }

        return undefined;
    }

    // ─── Auto-expand ────────────────────────────────────────

    /**
     * Ensures a logical line is visible by expanding any collapsed region that hides it.
     * A line is hidden if it falls in the range (startLine+1 .. endLine) of a collapsed region.
     */
    public ensureLineVisible(logicalLine: number): void {
        for (const region of this.foldedRegions) {
            if (region.isCollapsed && logicalLine > region.startLine && logicalLine <= region.endLine) {
                region.isCollapsed = false;
            }
        }
    }

    /**
     * Restores selections from a saved snapshot (used by UndoManager).
     */
    public restoreSelections(selections: readonly ISelection[]): void {
        this.selections = [...selections];
        this.ensureCursorVisible();
    }

    // ─── Private ────────────────────────────────────────────

    private ensureCursorVisible(): void {
        if (this.viewportWidth <= 0 || this.viewportHeight <= 0) return;
        if (this.selections.length === 0) return;

        const primary = this.selections[0];
        const visualLine = this.logicalToVisualLine(primary.active.line);
        if (visualLine < 0) return;

        if (visualLine < this.scrollTop) {
            this.scrollTop = visualLine;
        } else if (visualLine >= this.scrollTop + this.viewportHeight) {
            this.scrollTop = visualLine - this.viewportHeight + 1;
        }

        const col = primary.active.character;
        if (col < this.scrollLeft) {
            this.scrollLeft = col;
        } else if (col >= this.scrollLeft + this.viewportWidth) {
            this.scrollLeft = col - this.viewportWidth + 1;
        }
    }

    /**
     * Builds an array of logical line indices that are currently visible.
     * A line is hidden if it falls in range (startLine+1 .. endLine) of a collapsed region.
     */
    private buildVisibleLines(): number[] {
        // Collect all hidden line ranges from collapsed regions
        const hiddenRanges: { from: number; to: number }[] = [];
        for (const region of this.foldedRegions) {
            if (region.isCollapsed) {
                hiddenRanges.push({ from: region.startLine + 1, to: region.endLine });
            }
        }

        // Sort by start line for efficient processing
        hiddenRanges.sort((a, b) => a.from - b.from);

        const visible: number[] = [];
        const hiddenIdx = 0;

        for (let line = 0; line < this.document.lineCount; line++) {
            let isHidden = false;
            // Check against all hidden ranges
            for (let h = hiddenIdx; h < hiddenRanges.length; h++) {
                const range = hiddenRanges[h];
                if (line < range.from) {
                    break; // past all relevant ranges
                }
                if (line >= range.from && line <= range.to) {
                    isHidden = true;
                    break;
                }
            }
            if (!isHidden) {
                visible.push(line);
            }
        }

        return visible;
    }

    /**
     * Returns the previous visible logical line before the given logical line, or -1.
     */
    private previousVisibleLine(logicalLine: number): number {
        const visible = this.buildVisibleLines();
        const currentIdx = visible.indexOf(logicalLine);
        if (currentIdx > 0) {
            return visible[currentIdx - 1];
        }
        // If current line is not in visible list (hidden), find the last visible line before it
        if (currentIdx === -1) {
            for (let i = visible.length - 1; i >= 0; i--) {
                if (visible[i] < logicalLine) {
                    return visible[i];
                }
            }
        }
        return -1;
    }

    /**
     * Returns the next visible logical line after the given logical line, or -1.
     */
    private nextVisibleLine(logicalLine: number): number {
        const visible = this.buildVisibleLines();
        const currentIdx = visible.indexOf(logicalLine);
        if (currentIdx >= 0 && currentIdx < visible.length - 1) {
            return visible[currentIdx + 1];
        }
        // If current line is not in visible list (hidden), find the first visible line after it
        if (currentIdx === -1) {
            for (const vLine of visible) {
                if (vLine > logicalLine) {
                    return vLine;
                }
            }
        }
        return -1;
    }

    /**
     * Adjusts folding region boundaries after document edits.
     * Processes edits in reverse document order to avoid cascading adjustments.
     */
    private adjustFoldingRegionsForEdits(edits: readonly ITextEdit[]): void {
        // Sort edits in reverse document order (bottom-to-top)
        const sorted = [...edits].sort((a, b) => comparePositions(b.range.start, a.range.start));

        for (const edit of sorted) {
            const editStartLine = edit.range.start.line;
            const editEndLine = edit.range.end.line;
            const insertedLineCount = edit.text.split("\n").length;
            const deletedLineCount = editEndLine - editStartLine;
            const lineDelta = insertedLineCount - 1 - deletedLineCount;

            this.foldedRegions = this.foldedRegions.filter((region) => {
                // Edit completely after the region → no change
                if (editStartLine > region.endLine) {
                    return true;
                }

                // Edit completely before the region → shift both boundaries
                if (editEndLine < region.startLine) {
                    region.startLine += lineDelta;
                    region.endLine += lineDelta;
                    return true;
                }

                // Edit starts before region starts and ends inside/after region → remove
                if (editStartLine <= region.startLine && editEndLine >= region.startLine) {
                    return false;
                }

                // Edit is completely inside the region → adjust endLine
                if (editStartLine > region.startLine && editEndLine <= region.endLine) {
                    region.endLine += lineDelta;
                    return region.endLine > region.startLine; // remove if region became empty
                }

                // Edit starts inside region and extends beyond → remove
                if (
                    editStartLine > region.startLine &&
                    editStartLine <= region.endLine &&
                    editEndLine > region.endLine
                ) {
                    return false;
                }

                return true;
            });
        }
    }

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

    /**
     * Constructs a new selection after a cursor movement.
     * If inSelectionMode is false, anchor collapses to the new active position.
     * If true, the original anchor is preserved.
     */
    private buildSelection(
        original: ISelection,
        newLine: number,
        newChar: number,
        idealColumn: number,
        inSelectionMode: boolean,
    ): ISelection {
        if (inSelectionMode) {
            return createSelection(original.anchor.line, original.anchor.character, newLine, newChar, idealColumn);
        }
        return createCursorSelection(newLine, newChar, idealColumn);
    }

    /**
     * Sorts selections by their start position in document order.
     * Does not merge overlapping selections (kept simple for now).
     */
    private normalizeSelections(): void {
        this.selections.sort((a, b) => {
            const rangeA = selectionToRange(a);
            const rangeB = selectionToRange(b);
            return comparePositions(rangeA.start, rangeB.start);
        });
    }

    private cloneSelections(): ISelection[] {
        return this.selections.map((s) => ({ ...s, anchor: { ...s.anchor }, active: { ...s.active } }));
    }
}
