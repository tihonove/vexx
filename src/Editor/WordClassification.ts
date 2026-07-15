/**
 * Shared word-character classification, matching VS Code's default word
 * separators. Used by cursor word-navigation (EditorViewState), the occurrence
 * highlighter (computeWordOccurrences) and double-click word selection
 * (EditorElement).
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

/** Half-open `[start, end)` offsets of a word within a line. */
export interface IWordRange {
    readonly start: number;
    readonly end: number;
}

/**
 * `[start, end)` offsets of the word covering `character`, or `null` when the
 * caret is not on a word (whitespace or punctuation).
 *
 * Mirrors VS Code's `getWordAtPosition`: the caret sitting immediately *after* a
 * word's last character still counts as being on that word, so `foo|` selects
 * `foo`.
 */
export function findWordRangeAt(line: string, character: number): IWordRange | null {
    const len = line.length;
    // Anchor onto a word char: the char at the caret, else the one just before
    // it (caret sitting immediately after a word).
    let anchor: number;
    if (character < len && isWordChar(line[character])) {
        anchor = character;
    } else if (character > 0 && isWordChar(line[character - 1])) {
        anchor = character - 1;
    } else {
        return null;
    }

    let start = anchor;
    while (start > 0 && isWordChar(line[start - 1])) start--;
    let end = anchor + 1;
    while (end < len && isWordChar(line[end])) end++;
    return { start, end };
}
