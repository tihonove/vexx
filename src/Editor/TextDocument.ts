import type { ILineTokens } from "./ILineTokens.ts";
import { comparePositions } from "./IPosition.ts";
import type { ITextDocument } from "./ITextDocument.ts";
import type { ITextEdit } from "./ITextEdit.ts";

/**
 * Simple array-backed implementation of ITextDocument.
 * Uses string[] for line storage (Piece Table deferred to future iteration).
 */
export class TextDocument implements ITextDocument {
    private lines: string[];
    private tokensByLine = new Map<number, ILineTokens>();

    constructor(text: string) {
        this.lines = text.split("\n");
    }

    get lineCount(): number {
        return this.lines.length;
    }

    getLineContent(lineIndex: number): string {
        this.assertValidLineIndex(lineIndex);
        return this.lines[lineIndex];
    }

    getLineLength(lineIndex: number): number {
        this.assertValidLineIndex(lineIndex);
        return this.lines[lineIndex].length;
    }

    getText(): string {
        return this.lines.join("\n");
    }

    getLineTokens(lineIndex: number): ILineTokens | undefined {
        return this.tokensByLine.get(lineIndex);
    }

    setLineTokens(lineIndex: number, tokens: ILineTokens): void {
        this.tokensByLine.set(lineIndex, tokens);
    }

    applyEdits(edits: readonly ITextEdit[]): void {
        if (edits.length === 0) {
            return;
        }

        // Sort edits in reverse document order so that earlier edits don't invalidate later positions
        const sorted = [...edits].sort((a, b) => {
            const cmp = comparePositions(b.range.start, a.range.start);
            if (cmp !== 0) return cmp;
            return comparePositions(b.range.end, a.range.end);
        });

        for (const edit of sorted) {
            this.applySingleEdit(edit);
        }
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
