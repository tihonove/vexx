/**
 * Shared word-character classification, matching VS Code's default word
 * separators. Used by cursor word-navigation (EditorViewState) and by the
 * occurrence highlighter (computeWordOccurrences).
 */

/** Default word separators (mirrors VS Code `editor.wordSeparators`, plus whitespace). */
export const WORD_SEPARATORS = new Set(" \t\r\n`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?");

/** 0 = whitespace, 1 = punctuation/separator, 2 = word character. */
export function charClass(ch: string): number {
    if (ch === " " || ch === "\t") return 0; // whitespace
    if (WORD_SEPARATORS.has(ch)) return 1; // punctuation
    return 2; // word character
}

/**
 * True when `ch` is a single word character (identifier char). The empty
 * string (used to represent a line boundary) is not a word character, so
 * boundary checks treat line edges as non-word.
 */
export function isWordChar(ch: string): boolean {
    return ch.length === 1 && charClass(ch) === 2;
}
