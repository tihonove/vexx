import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

/**
 * A single terminal cell. Mutable for performance — avoids allocations on every frame.
 */
export class Cell {
    /** The displayed character (single grapheme) */
    public char: string;
    /** Foreground color as packed 24-bit RGB, or DEFAULT_COLOR */
    public fg: number;
    /** Background color as packed 24-bit RGB, or DEFAULT_COLOR */
    public bg: number;
    /** Bitmask of StyleFlags */
    public style: number;

    public constructor(
        char = " ",
        fg: number = DEFAULT_COLOR,
        bg: number = DEFAULT_COLOR,
        style: number = StyleFlags.None,
    ) {
        this.char = char;
        this.fg = fg;
        this.bg = bg;
        this.style = style;
    }

    public static empty(): Cell {
        return new Cell();
    }

    public equals(other: Cell): boolean {
        return this.char === other.char && this.fg === other.fg && this.bg === other.bg && this.style === other.style;
    }

    public copyFrom(other: Cell): void {
        this.char = other.char;
        this.fg = other.fg;
        this.bg = other.bg;
        this.style = other.style;
    }
}
