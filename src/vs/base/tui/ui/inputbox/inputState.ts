import { DisplayLine } from "../../../common/displayLine.ts";

/** Immutable snapshot of the editable state, used for undo/redo. */
interface Snapshot {
    text: string;
    cursorOffset: number;
    anchorOffset: number | null;
}

/** Kind of the last text-mutating edit, used to coalesce consecutive edits into one undo step. */
type EditKind = "insert" | "delete" | null;

/**
 * Pure state model for a single-line text input.
 * Tracks the text and cursor position (as a grapheme-aware offset).
 * No UI dependencies.
 */
export class InputState {
    private textValue = "";
    private cursorOffsetValue = 0;
    private anchorOffset: number | null = null;

    private undoStack: Snapshot[] = [];
    private redoStack: Snapshot[] = [];
    private lastEditKind: EditKind = null;

    public get text(): string {
        return this.textValue;
    }

    public get cursorOffset(): number {
        return this.cursorOffsetValue;
    }

    public get value(): string {
        return this.textValue;
    }

    public set value(v: string) {
        this.textValue = v;
        this.cursorOffsetValue = v.length;
        this.anchorOffset = null;
        // Programmatic content replacement is a fresh baseline — drop edit history.
        this.undoStack = [];
        this.redoStack = [];
        this.lastEditKind = null;
    }

    // ─── Undo / Redo ─────────────────────────────────────────

    public get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public undo(): void {
        const prev = this.undoStack.pop();
        if (prev === undefined) return;
        this.redoStack.push(this.snapshot());
        this.restore(prev);
        this.lastEditKind = null;
    }

    public redo(): void {
        const next = this.redoStack.pop();
        if (next === undefined) return;
        this.undoStack.push(this.snapshot());
        this.restore(next);
        this.lastEditKind = null;
    }

    private snapshot(): Snapshot {
        return { text: this.textValue, cursorOffset: this.cursorOffsetValue, anchorOffset: this.anchorOffset };
    }

    private restore(s: Snapshot): void {
        this.textValue = s.text;
        this.cursorOffsetValue = s.cursorOffset;
        this.anchorOffset = s.anchorOffset;
    }

    /** Push a snapshot of the current state and invalidate the redo stack. */
    private pushUndo(): void {
        this.undoStack.push(this.snapshot());
        this.redoStack = [];
    }

    /** Start a brand-new undo group: snapshot now, and don't coalesce the next edit into it. */
    private breakUndo(): void {
        this.pushUndo();
        this.lastEditKind = null;
    }

    /** Record an edit that may coalesce with the previous one when it is of the same kind. */
    private recordEdit(kind: "insert" | "delete"): void {
        if (this.lastEditKind !== kind) {
            this.pushUndo();
        }
        this.lastEditKind = kind;
    }

    // ─── Selection ───────────────────────────────────────────

    public get hasSelection(): boolean {
        return this.anchorOffset !== null && this.anchorOffset !== this.cursorOffsetValue;
    }

    public get selectionStart(): number {
        if (this.anchorOffset === null) return this.cursorOffsetValue;
        return Math.min(this.anchorOffset, this.cursorOffsetValue);
    }

    public get selectionEnd(): number {
        if (this.anchorOffset === null) return this.cursorOffsetValue;
        return Math.max(this.anchorOffset, this.cursorOffsetValue);
    }

    public get selectedText(): string {
        if (!this.hasSelection) return "";
        return this.textValue.slice(this.selectionStart, this.selectionEnd);
    }

    public clearSelection(): void {
        this.anchorOffset = null;
        this.lastEditKind = null;
    }

    public selectAll(): void {
        this.anchorOffset = 0;
        this.cursorOffsetValue = this.textValue.length;
        this.lastEditKind = null;
    }

    public selectLeft(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.moveCursorLeftRaw();
        this.lastEditKind = null;
    }

    public selectRight(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.moveCursorRightRaw();
        this.lastEditKind = null;
    }

    public selectToStart(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.cursorOffsetValue = 0;
        this.lastEditKind = null;
    }

    public selectToEnd(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.cursorOffsetValue = this.textValue.length;
        this.lastEditKind = null;
    }

    public selectWordLeft(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.cursorOffsetValue = this.wordBoundaryLeft(this.cursorOffsetValue);
        this.lastEditKind = null;
    }

    public selectWordRight(): void {
        this.anchorOffset ??= this.cursorOffsetValue;
        this.cursorOffsetValue = this.wordBoundaryRight(this.cursorOffsetValue);
        this.lastEditKind = null;
    }

    private deleteSelection(): void {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.textValue = this.textValue.slice(0, start) + this.textValue.slice(end);
        this.cursorOffsetValue = start;
        this.anchorOffset = null;
    }

    // ─── Editing ─────────────────────────────────────────────

    /** Insert text at the current cursor position (replaces selection if any). */
    public insert(chars: string): void {
        // Single-char typing coalesces into one undo step; multi-char (paste) and
        // typing-over-a-selection each form their own undo group.
        if (chars.length === 1 && !this.hasSelection) {
            this.recordEdit("insert");
        } else {
            this.breakUndo();
        }
        if (this.hasSelection) this.deleteSelection();
        this.textValue =
            this.textValue.slice(0, this.cursorOffsetValue) + chars + this.textValue.slice(this.cursorOffsetValue);
        this.cursorOffsetValue += chars.length;
    }

    /** Delete the grapheme cluster immediately to the left of the cursor (Backspace). */
    public deleteLeft(): void {
        if (this.hasSelection) {
            this.breakUndo();
            this.deleteSelection();
            return;
        }
        if (this.cursorOffsetValue === 0) return;
        this.recordEdit("delete");
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset + slot.length === this.cursorOffsetValue) {
                this.textValue = this.textValue.slice(0, slot.offset) + this.textValue.slice(this.cursorOffsetValue);
                this.cursorOffsetValue = slot.offset;
                return;
            }
        }
        // Fallback: delete one code unit
        this.textValue =
            this.textValue.slice(0, this.cursorOffsetValue - 1) + this.textValue.slice(this.cursorOffsetValue);
        this.cursorOffsetValue--;
    }

    /** Delete the grapheme cluster immediately to the right of the cursor (Delete key). */
    public deleteRight(): void {
        if (this.hasSelection) {
            this.breakUndo();
            this.deleteSelection();
            return;
        }
        if (this.cursorOffsetValue >= this.textValue.length) return;
        this.recordEdit("delete");
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset === this.cursorOffsetValue) {
                this.textValue =
                    this.textValue.slice(0, this.cursorOffsetValue) + this.textValue.slice(slot.offset + slot.length);
                return;
            }
        }
        // Fallback: delete one code unit
        this.textValue =
            this.textValue.slice(0, this.cursorOffsetValue) + this.textValue.slice(this.cursorOffsetValue + 1);
    }

    /** Move cursor one grapheme to the left (ArrowLeft). */
    public moveCursorLeft(): void {
        this.lastEditKind = null;
        if (this.hasSelection) {
            this.cursorOffsetValue = this.selectionStart;
            this.anchorOffset = null;
            return;
        }
        this.anchorOffset = null;
        this.moveCursorLeftRaw();
    }

    /** Move cursor one grapheme to the right (ArrowRight). */
    public moveCursorRight(): void {
        this.lastEditKind = null;
        if (this.hasSelection) {
            this.cursorOffsetValue = this.selectionEnd;
            this.anchorOffset = null;
            return;
        }
        this.anchorOffset = null;
        this.moveCursorRightRaw();
    }

    /** Move cursor to the beginning of the line (Home). */
    public moveCursorToStart(): void {
        this.anchorOffset = null;
        this.cursorOffsetValue = 0;
        this.lastEditKind = null;
    }

    /** Move cursor to the end of the line (End). */
    public moveCursorToEnd(): void {
        this.anchorOffset = null;
        this.cursorOffsetValue = this.textValue.length;
        this.lastEditKind = null;
    }

    /** Move cursor to the start of the previous word (Ctrl+ArrowLeft). */
    public moveCursorWordLeft(): void {
        this.anchorOffset = null;
        this.cursorOffsetValue = this.wordBoundaryLeft(this.cursorOffsetValue);
        this.lastEditKind = null;
    }

    /** Move cursor to the end of the next word (Ctrl+ArrowRight). */
    public moveCursorWordRight(): void {
        this.anchorOffset = null;
        this.cursorOffsetValue = this.wordBoundaryRight(this.cursorOffsetValue);
        this.lastEditKind = null;
    }

    /** Delete from cursor to the previous word boundary (Ctrl+Backspace). */
    public deleteWordLeft(): void {
        if (this.hasSelection) {
            this.breakUndo();
            this.deleteSelection();
            return;
        }
        const target = this.wordBoundaryLeft(this.cursorOffsetValue);
        if (target === this.cursorOffsetValue) return;
        this.breakUndo();
        this.textValue = this.textValue.slice(0, target) + this.textValue.slice(this.cursorOffsetValue);
        this.cursorOffsetValue = target;
    }

    /** Delete from cursor to the next word boundary (Ctrl+Delete). */
    public deleteWordRight(): void {
        if (this.hasSelection) {
            this.breakUndo();
            this.deleteSelection();
            return;
        }
        const target = this.wordBoundaryRight(this.cursorOffsetValue);
        if (target === this.cursorOffsetValue) return;
        this.breakUndo();
        this.textValue = this.textValue.slice(0, this.cursorOffsetValue) + this.textValue.slice(target);
    }

    private moveCursorLeftRaw(): void {
        if (this.cursorOffsetValue === 0) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset + slot.length === this.cursorOffsetValue) {
                this.cursorOffsetValue = slot.offset;
                return;
            }
        }
        this.cursorOffsetValue = Math.max(0, this.cursorOffsetValue - 1);
    }

    private moveCursorRightRaw(): void {
        if (this.cursorOffsetValue >= this.textValue.length) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset === this.cursorOffsetValue) {
                this.cursorOffsetValue = slot.offset + slot.length;
                return;
            }
        }
        this.cursorOffsetValue = Math.min(this.textValue.length, this.cursorOffsetValue + 1);
    }

    private wordBoundaryLeft(pos: number): number {
        // Skip non-word chars going left, then skip word chars going left
        let p = pos;
        while (p > 0 && !InputState.isWordChar(this.textValue[p - 1])) p--;
        while (p > 0 && InputState.isWordChar(this.textValue[p - 1])) p--;
        return p;
    }

    private wordBoundaryRight(pos: number): number {
        // Skip non-word chars going right, then skip word chars going right
        let p = pos;
        const len = this.textValue.length;
        while (p < len && !InputState.isWordChar(this.textValue[p])) p++;
        while (p < len && InputState.isWordChar(this.textValue[p])) p++;
        return p;
    }

    private static isWordChar(ch: string): boolean {
        return /\w/.test(ch);
    }
}
