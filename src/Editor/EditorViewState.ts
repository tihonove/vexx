import { DisplayLine } from "../Common/DisplayLine.ts";

import type { IFoldingRegion } from "./IFoldingRegion.ts";
import type { ILineTokens } from "./ILineTokens.ts";
import { comparePositions } from "./IPosition.ts";
import { createRange } from "./IRange.ts";
import type { ISelection } from "./ISelection.ts";
import {
    createCursorSelection,
    createSelection,
    getIdealColumn,
    isSelectionCollapsed,
    selectionToRange,
} from "./ISelection.ts";
import type { ITextDocument } from "./ITextDocument.ts";
import type { ITextEdit } from "./ITextEdit.ts";
import { createTextEdit } from "./ITextEdit.ts";
import type { IUndoElement } from "./IUndoElement.ts";
import type { DocumentTokenStore } from "./Tokenization/DocumentTokenStore.ts";

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
    public tabSize = 4;
    public selections: ISelection[];
    public readonly document: ITextDocument;
    public foldedRegions: IFoldingRegion[] = [];
    /**
     * Optional per-document token cache. The renderer is responsible for
     * calling `tokenStore.tokenizeUpTo(visibleBottom)` before reading tokens.
     */
    public tokenStore: DocumentTokenStore | undefined;

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
     * Returns tokens for a visual line (from the attached token store, if any).
     * Does NOT trigger lazy tokenization — the renderer must call
     * `tokenStore.tokenizeUpTo(...)` first.
     */
    public getViewLineTokens(visualLineNumber: number): ILineTokens | undefined {
        if (!this.tokenStore) return undefined;
        const logicalLine = this.visualToLogicalLine(visualLineNumber);
        if (logicalLine < 0 || logicalLine >= this.document.lineCount) {
            return undefined;
        }
        return this.tokenStore.getLineTokens(logicalLine);
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
     * Returns the text covered by the primary (first) selection.
     * Returns an empty string when the selection is collapsed (cursor only).
     */
    public getSelectedText(): string {
        const sel = this.selections[0];
        if (isSelectionCollapsed(sel)) {
            return "";
        }
        return this.document.getTextInRange(selectionToRange(sel));
    }

    /**
     * Inserts text at every cursor/selection, replacing any selected content.
     * Delegates to type() which already handles selection replacement.
     */
    public insertText(text: string): IUndoElement {
        return this.type(text);
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
                // Collapsed: expand one grapheme left
                const pos = sel.active;
                if (pos.character > 0) {
                    const lineContent = this.document.getLineContent(pos.line);
                    const dl = new DisplayLine(lineContent, this.tabSize);
                    let prevOffset: number;
                    if (pos.character >= lineContent.length) {
                        prevOffset = dl.slots.length > 0 ? dl.slots[dl.slots.length - 1].offset : 0;
                    } else {
                        const slotIndex = dl.slotIndexAtOffset(pos.character);
                        prevOffset = slotIndex > 0 ? dl.slots[slotIndex - 1].offset : 0;
                    }
                    edits.push(createTextEdit(createRange(pos.line, prevOffset, pos.line, pos.character), ""));
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
            let newChar: number;

            if (pos.character > 0) {
                const lineContent = this.document.getLineContent(pos.line);
                const dl = new DisplayLine(lineContent, this.tabSize);
                if (pos.character >= lineContent.length) {
                    newChar = dl.slots.length > 0 ? dl.slots[dl.slots.length - 1].offset : 0;
                } else {
                    const slotIndex = dl.slotIndexAtOffset(pos.character);
                    newChar = slotIndex > 0 ? dl.slots[slotIndex - 1].offset : 0;
                }
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

            const targetDl = new DisplayLine(this.document.getLineContent(newLine), this.tabSize);
            return this.buildSelection(sel, newLine, newChar, targetDl.offsetToColumn(newChar), inSelectionMode);
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
            let newChar: number;

            if (pos.character < lineLen) {
                const lineContent = this.document.getLineContent(pos.line);
                const dl = new DisplayLine(lineContent, this.tabSize);
                const slotIndex = dl.slotIndexAtOffset(pos.character);
                if (slotIndex >= 0 && slotIndex < dl.slots.length - 1) {
                    newChar = dl.slots[slotIndex + 1].offset;
                } else {
                    newChar = lineLen;
                }
            } else {
                const nextVisible = this.nextVisibleLine(pos.line);
                if (nextVisible >= 0) {
                    newLine = nextVisible;
                    newChar = 0;
                } else {
                    return sel;
                }
            }

            const targetDl = new DisplayLine(this.document.getLineContent(newLine), this.tabSize);
            return this.buildSelection(sel, newLine, newChar, targetDl.offsetToColumn(newChar), inSelectionMode);
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
                let ideal = getIdealColumn(sel);
                if (sel.idealColumn === undefined) {
                    const currentDl = new DisplayLine(this.document.getLineContent(pos.line), this.tabSize);
                    ideal = currentDl.offsetToColumn(pos.character);
                }
                const targetDl = new DisplayLine(this.document.getLineContent(prevVisible), this.tabSize);
                const newChar = targetDl.columnToOffset(ideal);
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
                let ideal = getIdealColumn(sel);
                if (sel.idealColumn === undefined) {
                    const currentDl = new DisplayLine(this.document.getLineContent(pos.line), this.tabSize);
                    ideal = currentDl.offsetToColumn(pos.character);
                }
                const targetDl = new DisplayLine(this.document.getLineContent(nextVisible), this.tabSize);
                const newChar = targetDl.columnToOffset(ideal);
                return this.buildSelection(sel, nextVisible, newChar, ideal, inSelectionMode);
            }
            return sel;
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor to the very beginning of the document (line 0, char 0).
     */
    public cursorTop(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            return this.buildSelection(sel, 0, 0, 0, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor to the very end of the document (last line, last char).
     */
    public cursorBottom(inSelectionMode = false): void {
        const lastLine = this.document.lineCount - 1;
        const lastChar = this.document.getLineLength(lastLine);
        const dl = new DisplayLine(this.document.getLineContent(lastLine), this.tabSize);
        const idealCol = dl.offsetToColumn(lastChar);
        this.selections = this.selections.map((sel) => {
            return this.buildSelection(sel, lastLine, lastChar, idealCol, inSelectionMode);
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
     * Moves each cursor one word to the left.
     * At the start of a line, wraps to the end of the previous visible line.
     */
    public cursorWordLeft(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            if (pos.character === 0) {
                const prevLine = this.previousVisibleLine(pos.line);
                if (prevLine >= 0) {
                    const lineLen = this.document.getLineLength(prevLine);
                    const dl = new DisplayLine(this.document.getLineContent(prevLine), this.tabSize);
                    return this.buildSelection(sel, prevLine, lineLen, dl.offsetToColumn(lineLen), inSelectionMode);
                }
                return sel;
            }
            const line = this.document.getLineContent(pos.line);
            const newChar = findWordBoundaryLeft(line, pos.character);
            const dl = new DisplayLine(line, this.tabSize);
            return this.buildSelection(sel, pos.line, newChar, dl.offsetToColumn(newChar), inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor one word to the right.
     * At the end of a line, wraps to the start of the next visible line.
     */
    public cursorWordRight(inSelectionMode = false): void {
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            const lineLen = this.document.getLineLength(pos.line);
            if (pos.character >= lineLen) {
                const nextLine = this.nextVisibleLine(pos.line);
                if (nextLine >= 0) {
                    return this.buildSelection(sel, nextLine, 0, 0, inSelectionMode);
                }
                return sel;
            }
            const line = this.document.getLineContent(pos.line);
            const newChar = findWordBoundaryRight(line, pos.character);
            const dl = new DisplayLine(line, this.tabSize);
            return this.buildSelection(sel, pos.line, newChar, dl.offsetToColumn(newChar), inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Selects the entire document content.
     */
    public selectAll(): void {
        const lastLine = this.document.lineCount - 1;
        const lastChar = this.document.getLineLength(lastLine);
        this.selections = [createSelection(0, 0, lastLine, lastChar)];
    }

    /**
     * Moves each cursor one page (viewportHeight lines) down.
     * Preserves idealColumn for vertical navigation.
     */
    public cursorPageDown(inSelectionMode = false): void {
        const pageSize = Math.max(1, this.viewportHeight - 1);
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            let ideal = getIdealColumn(sel);
            if (sel.idealColumn === undefined) {
                const currentDl = new DisplayLine(this.document.getLineContent(pos.line), this.tabSize);
                ideal = currentDl.offsetToColumn(pos.character);
            }
            let targetLine = pos.line;
            for (let i = 0; i < pageSize; i++) {
                const next = this.nextVisibleLine(targetLine);
                if (next < 0) break;
                targetLine = next;
            }
            const targetDl = new DisplayLine(this.document.getLineContent(targetLine), this.tabSize);
            const newChar = targetDl.columnToOffset(ideal);
            return this.buildSelection(sel, targetLine, newChar, ideal, inSelectionMode);
        });
        this.normalizeSelections();
        this.ensureCursorVisible();
    }

    /**
     * Moves each cursor one page (viewportHeight lines) up.
     * Preserves idealColumn for vertical navigation.
     */
    public cursorPageUp(inSelectionMode = false): void {
        const pageSize = Math.max(1, this.viewportHeight - 1);
        this.selections = this.selections.map((sel) => {
            const pos = sel.active;
            let ideal = getIdealColumn(sel);
            if (sel.idealColumn === undefined) {
                const currentDl = new DisplayLine(this.document.getLineContent(pos.line), this.tabSize);
                ideal = currentDl.offsetToColumn(pos.character);
            }
            let targetLine = pos.line;
            for (let i = 0; i < pageSize; i++) {
                const prev = this.previousVisibleLine(targetLine);
                if (prev < 0) break;
                targetLine = prev;
            }
            const targetDl = new DisplayLine(this.document.getLineContent(targetLine), this.tabSize);
            const newChar = targetDl.columnToOffset(ideal);
            return this.buildSelection(sel, targetLine, newChar, ideal, inSelectionMode);
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
                // Collapsed: expand one grapheme right
                const pos = sel.active;
                const lineLen = this.document.getLineLength(pos.line);
                if (pos.character < lineLen) {
                    const lineContent = this.document.getLineContent(pos.line);
                    const dl = new DisplayLine(lineContent, this.tabSize);
                    const slotIndex = dl.slotIndexAtOffset(pos.character);
                    let nextEnd: number;
                    if (slotIndex >= 0) {
                        const slot = dl.slots[slotIndex];
                        nextEnd = slot.offset + slot.length;
                    } else {
                        nextEnd = Math.min(pos.character + 1, lineLen);
                    }
                    edits.push(createTextEdit(createRange(pos.line, pos.character, pos.line, nextEnd), ""));
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

    /**
     * Deletes one word to the left of each cursor, or deletes the selection.
     */
    public deleteWordLeft(): IUndoElement | undefined {
        const edits: ITextEdit[] = [];

        for (const sel of this.sortedSelections()) {
            const range = selectionToRange(sel);
            if (range.start.line === range.end.line && range.start.character === range.end.character) {
                const pos = sel.active;
                if (pos.character > 0) {
                    const line = this.document.getLineContent(pos.line);
                    const wordStart = findWordBoundaryLeft(line, pos.character);
                    edits.push(createTextEdit(createRange(pos.line, wordStart, pos.line, pos.character), ""));
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
                label: "deleteWordLeft",
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

    /**
     * Deletes one word to the right of each cursor, or deletes the selection.
     */
    public deleteWordRight(): IUndoElement | undefined {
        const edits: ITextEdit[] = [];

        for (const sel of this.sortedSelections()) {
            const range = selectionToRange(sel);
            if (range.start.line === range.end.line && range.start.character === range.end.character) {
                const pos = sel.active;
                const lineLen = this.document.getLineLength(pos.line);
                if (pos.character < lineLen) {
                    const line = this.document.getLineContent(pos.line);
                    const wordEnd = findWordBoundaryRight(line, pos.character);
                    edits.push(createTextEdit(createRange(pos.line, pos.character, pos.line, wordEnd), ""));
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
                label: "deleteWordRight",
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

        const lineContent = this.document.getLineContent(primary.active.line);
        const dl = new DisplayLine(lineContent, this.tabSize);
        const col = dl.offsetToColumn(primary.active.character);
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

// ─── Word Boundary Helpers ──────────────────────────────────

const WORD_SEPARATORS = new Set(" \t\r\n`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?");

function charClass(ch: string): number {
    if (ch === " " || ch === "\t") return 0; // whitespace
    if (WORD_SEPARATORS.has(ch)) return 1; // punctuation
    return 2; // word character
}

/**
 * Finds the start of the previous word boundary, scanning left from `offset`.
 * Mirrors VS Code Ctrl+Left behavior: skip whitespace, then skip same-class characters.
 */
function findWordBoundaryLeft(line: string, offset: number): number {
    let pos = offset;
    // Skip whitespace
    while (pos > 0 && charClass(line[pos - 1]) === 0) {
        pos--;
    }
    if (pos === 0) return 0;
    // Skip same-class chars
    const cls = charClass(line[pos - 1]);
    while (pos > 0 && charClass(line[pos - 1]) === cls) {
        pos--;
    }
    return pos;
}

/**
 * Finds the end of the next word boundary, scanning right from `offset`.
 * Mirrors VS Code Ctrl+Right behavior: skip same-class characters, then skip whitespace.
 */
function findWordBoundaryRight(line: string, offset: number): number {
    let pos = offset;
    const len = line.length;
    if (pos >= len) return len;
    // Skip same-class chars
    const cls = charClass(line[pos]);
    while (pos < len && charClass(line[pos]) === cls) {
        pos++;
    }
    // Skip whitespace
    while (pos < len && charClass(line[pos]) === 0) {
        pos++;
    }
    return pos;
}
