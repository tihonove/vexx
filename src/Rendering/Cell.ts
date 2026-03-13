import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

/**
 * A single terminal cell. Mutable for performance — avoids allocations on every frame.
 *
 * Fields:
 *  - `char`  — the displayed character (single grapheme)
 *  - `fg`    — foreground color as packed 24-bit RGB, or DEFAULT_COLOR
 *  - `bg`    — background color as packed 24-bit RGB, or DEFAULT_COLOR
 *  - `style` — bitmask of StyleFlags
 */
export class Cell {
    char: string;
    fg: number;
    bg: number;
    style: number;

    constructor(
        char: string = " ",
        fg: number = DEFAULT_COLOR,
        bg: number = DEFAULT_COLOR,
        style: number = StyleFlags.None,
    ) {
        this.char = char;
        this.fg = fg;
        this.bg = bg;
        this.style = style;
    }

    static empty(): Cell {
        return new Cell();
    }

    equals(other: Cell): boolean {
        return this.char === other.char && this.fg === other.fg && this.bg === other.bg && this.style === other.style;
    }

    copyFrom(other: Cell): void {
        this.char = other.char;
        this.fg = other.fg;
        this.bg = other.bg;
        this.style = other.style;
    }
}
