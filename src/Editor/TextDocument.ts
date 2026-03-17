import type { ILineTokens } from "./ILineTokens.ts";
import { comparePositions } from "./IPosition.ts";
import type { IRange } from "./IRange.ts";
import { createRange } from "./IRange.ts";
import type { IApplyEditsResult, ITextDocument } from "./ITextDocument.ts";
import type { ITextEdit } from "./ITextEdit.ts";
import { createTextEdit } from "./ITextEdit.ts";

/**
 * Simple array-backed implementation of ITextDocument.
 * Uses string[] for line storage (Piece Table deferred to future iteration).
 */
export class TextDocument implements ITextDocument {
    private lines: string[];
    private tokensByLine = new Map<number, ILineTokens>();
    private _versionId = 0;

    public constructor(text: string) {
        this.lines = text.split("\n");
    }

    public get versionId(): number {
        return this._versionId;
    }

    public get lineCount(): number {
        return this.lines.length;
    }

    public getLineContent(lineIndex: number): string {
        this.assertValidLineIndex(lineIndex);
        return this.lines[lineIndex];
    }

    public getLineLength(lineIndex: number): number {
        this.assertValidLineIndex(lineIndex);
        return this.lines[lineIndex].length;
    }

    public getText(): string {
        return this.lines.join("\n");
    }

    public getTextInRange(range: IRange): string {
        const { start, end } = range;
        if (start.line === end.line) {
            return this.lines[start.line].substring(start.character, end.character);
        }
        const result: string[] = [];
        result.push(this.lines[start.line].substring(start.character));
        for (let i = start.line + 1; i < end.line; i++) {
            result.push(this.lines[i]);
        }
        result.push(this.lines[end.line].substring(0, end.character));
        return result.join("\n");
    }

    public getLineTokens(lineIndex: number): ILineTokens | undefined {
        return this.tokensByLine.get(lineIndex);
    }

    public setLineTokens(lineIndex: number, tokens: ILineTokens): void {
        this.tokensByLine.set(lineIndex, tokens);
    }

    public applyEdits(edits: readonly ITextEdit[]): IApplyEditsResult {
        if (edits.length === 0) {
            return { appliedVersion: this._versionId, inverseEdits: [] };
        }

        this._versionId++;

        // Sort edits in document order (ascending) to collect old texts
        const docOrder = [...edits].sort((a, b) => {
            const cmp = comparePositions(a.range.start, b.range.start);
            if (cmp !== 0) return cmp;
            return comparePositions(a.range.end, b.range.end);
        });

        // Collect old texts BEFORE applying any edits
        const oldTexts = docOrder.map((edit) => this.getTextInRange(edit.range));

        // Sort edits in reverse document order for safe application
        const reversed = [...edits].sort((a, b) => {
            const cmp = comparePositions(b.range.start, a.range.start);
            if (cmp !== 0) return cmp;
            return comparePositions(b.range.end, a.range.end);
        });

        for (const edit of reversed) {
            this.applySingleEdit(edit);
        }

        // Compute inverse edits in new-document coordinates
        const inverseEdits = this.computeInverseEdits(docOrder, oldTexts);

        return { appliedVersion: this._versionId, inverseEdits };
    }

    private computeInverseEdits(editsInDocOrder: readonly ITextEdit[], oldTexts: string[]): ITextEdit[] {
        const inverse: ITextEdit[] = [];
        let accLineDelta = 0;
        let accCharDelta = 0;
        let lastEditLine = -1;

        for (let i = 0; i < editsInDocOrder.length; i++) {
            const edit = editsInDocOrder[i];
            const oldText = oldTexts[i];

            // Compute the new start position (where this edit landed in the new document)
            const newStartLine = edit.range.start.line + accLineDelta;
            const newStartChar =
                edit.range.start.line === lastEditLine
                    ? edit.range.start.character + accCharDelta
                    : edit.range.start.character;

            // Compute the new end position based on the inserted text dimensions
            const insertedLines = edit.text.split("\n");
            const insertedLineCount = insertedLines.length;
            let newEndLine: number;
            let newEndChar: number;

            if (insertedLineCount === 1) {
                newEndLine = newStartLine;
                newEndChar = newStartChar + insertedLines[0].length;
            } else {
                newEndLine = newStartLine + insertedLineCount - 1;
                newEndChar = insertedLines[insertedLineCount - 1].length;
            }

            // The inverse edit replaces the inserted text range with the old text
            inverse.push(
                createTextEdit(createRange(newStartLine, newStartChar, newEndLine, newEndChar), oldText),
            );

            // Update accumulated deltas
            const deletedLines = edit.range.end.line - edit.range.start.line;
            const lineDelta = insertedLineCount - 1 - deletedLines;
            accLineDelta += lineDelta;

            if (insertedLineCount === 1 && deletedLines === 0) {
                const charDelta =
                    insertedLines[0].length - (edit.range.end.character - edit.range.start.character);
                if (edit.range.start.line === lastEditLine) {
                    accCharDelta += charDelta;
                } else {
                    accCharDelta = charDelta;
                }
                lastEditLine = edit.range.start.line;
            } else {
                accCharDelta = 0;
                lastEditLine = -1;
            }
        }

        return inverse;
    }

    // ─── Private ────────────────────────────────────────────

    private applySingleEdit(edit: ITextEdit): void {
        const { range, text } = edit;
        const { start, end } = range;

        const startLine = start.line;
        const endLine = end.line;
        const startChar = start.character;
        const endChar = end.character;

        // Build the resulting text from prefix + inserted text + suffix
        const prefix = this.lines[startLine].substring(0, startChar);
        const suffix = this.lines[endLine].substring(endChar);
        const insertedText = prefix + text + suffix;
        const newLines = insertedText.split("\n");

        // How many lines we delete vs insert
        const deletedLineCount = endLine - startLine + 1;
        const insertedLineCount = newLines.length;
        const lineDelta = insertedLineCount - deletedLineCount;

        // Shift tokens before modifying lines
        this.shiftTokensForEdit(startLine, endLine, startChar, endChar, text, lineDelta);

        // Replace lines in the array
        this.lines.splice(startLine, deletedLineCount, ...newLines);
    }

    private shiftTokensForEdit(
        startLine: number,
        endLine: number,
        startChar: number,
        endChar: number,
        insertedText: string,
        lineDelta: number,
    ): void {
        // Invalidate tokens on all lines that the edit touches
        for (let i = startLine; i <= endLine; i++) {
            this.tokensByLine.delete(i);
        }

        if (lineDelta !== 0) {
            // Shift tokens for lines below the edited region
            this.shiftLineTokenKeys(endLine + 1, lineDelta);
        } else if (startLine === endLine) {
            // Single-line edit: shift character offsets on the same line if tokens still exist
            // (tokens were already deleted above, so this handles the case where we want
            //  to keep tokens that are entirely before/after the edit)
            // For MVP we simply invalidate; a smarter version would shift offsets
        }
    }

    /**
     * Shifts all token line keys >= fromLine by delta.
     * Moves entries in the Map so that tokens remain attached to their correct lines.
     */
    private shiftLineTokenKeys(fromLine: number, delta: number): void {
        if (delta === 0) return;

        // Collect entries that need shifting
        const toShift: [number, ILineTokens][] = [];
        for (const [lineIndex, tokens] of this.tokensByLine) {
            if (lineIndex >= fromLine) {
                toShift.push([lineIndex, tokens]);
            }
        }

        // Remove old keys
        for (const [lineIndex] of toShift) {
            this.tokensByLine.delete(lineIndex);
        }

        // Re-insert with shifted keys
        for (const [lineIndex, tokens] of toShift) {
            const newIndex = lineIndex + delta;
            if (newIndex >= 0) {
                this.tokensByLine.set(newIndex, tokens);
            }
        }
    }

    private assertValidLineIndex(lineIndex: number): void {
        if (lineIndex < 0 || lineIndex >= this.lines.length) {
            throw new RangeError(
                `Line index ${lineIndex.toString()} out of bounds [0, ${(this.lines.length - 1).toString()}]`,
            );
        }
    }
}
