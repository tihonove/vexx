import { DisplayLine } from "../../Common/DisplayLine.ts";

/**
 * Pure state model for a single-line text input.
 * Tracks the text and cursor position (as a grapheme-aware offset).
 * No UI dependencies.
 */
export class InputState {
    private textValue: string = "";
    private cursorOffsetValue: number = 0;

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
    }

    /** Insert text at the current cursor position and advance the cursor. */
    public insert(chars: string): void {
        this.textValue =
            this.textValue.slice(0, this.cursorOffsetValue) + chars + this.textValue.slice(this.cursorOffsetValue);
        this.cursorOffsetValue += chars.length;
    }

    /** Delete the grapheme cluster immediately to the left of the cursor (Backspace). */
    public deleteLeft(): void {
        if (this.cursorOffsetValue === 0) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset + slot.length === this.cursorOffsetValue) {
                this.textValue = this.textValue.slice(0, slot.offset) + this.textValue.slice(this.cursorOffsetValue);
                this.cursorOffsetValue = slot.offset;
                return;
            }
        }
        // Fallback: delete one code unit
        this.textValue = this.textValue.slice(0, this.cursorOffsetValue - 1) + this.textValue.slice(this.cursorOffsetValue);
        this.cursorOffsetValue--;
    }

    /** Delete the grapheme cluster immediately to the right of the cursor (Delete key). */
    public deleteRight(): void {
        if (this.cursorOffsetValue >= this.textValue.length) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset === this.cursorOffsetValue) {
                this.textValue =
                    this.textValue.slice(0, this.cursorOffsetValue) + this.textValue.slice(slot.offset + slot.length);
                return;
            }
        }
        // Fallback: delete one code unit
        this.textValue = this.textValue.slice(0, this.cursorOffsetValue) + this.textValue.slice(this.cursorOffsetValue + 1);
    }

    /** Move cursor one grapheme to the left (ArrowLeft). */
    public moveCursorLeft(): void {
        if (this.cursorOffsetValue === 0) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset + slot.length === this.cursorOffsetValue) {
                this.cursorOffsetValue = slot.offset;
                return;
            }
        }
        // Fallback
        this.cursorOffsetValue = Math.max(0, this.cursorOffsetValue - 1);
    }

    /** Move cursor one grapheme to the right (ArrowRight). */
    public moveCursorRight(): void {
        if (this.cursorOffsetValue >= this.textValue.length) return;
        const dl = new DisplayLine(this.textValue);
        for (const slot of dl.slots) {
            if (slot.offset === this.cursorOffsetValue) {
                this.cursorOffsetValue = slot.offset + slot.length;
                return;
            }
        }
        // Fallback
        this.cursorOffsetValue = Math.min(this.textValue.length, this.cursorOffsetValue + 1);
    }

    /** Move cursor to the beginning of the line (Home). */
    public moveCursorToStart(): void {
        this.cursorOffsetValue = 0;
    }

    /** Move cursor to the end of the line (End). */
    public moveCursorToEnd(): void {
        this.cursorOffsetValue = this.textValue.length;
    }
}
