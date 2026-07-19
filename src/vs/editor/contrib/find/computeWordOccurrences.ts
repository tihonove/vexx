import type { IPosition } from "../../common/core/iPosition.ts";
import type { IRange } from "../../common/core/iRange.ts";
import { createRange } from "../../common/core/iRange.ts";
import { findWordRangeAt, isWordChar } from "../../common/core/wordClassification.ts";
import type { ITextDocument } from "../../common/model/iTextDocument.ts";

/**
 * Computes the ranges of every occurrence of the word under `position`, to be
 * highlighted like VS Code's "occurrences highlight" (the textual fallback used
 * when no language provider supplies document highlights).
 *
 * The word under the cursor is the maximal run of word characters that the
 * cursor sits inside of or is adjacent to (mirrors VS Code `getWordAtPosition`,
 * which also treats the caret just past a word's end as being on that word).
 * Matching is case-sensitive and whole-word (an occurrence bordered by word
 * characters — e.g. `text` inside `context` — is ignored), matching VS Code's
 * textual word highlighter (`matchCase: true, wholeWord: true`).
 *
 * Returns an empty array when the cursor is not on a word (whitespace or
 * punctuation). The occurrence under the cursor itself is included.
 */
export function computeWordOccurrences(document: ITextDocument, position: IPosition): IRange[] {
    if (position.line < 0 || position.line >= document.lineCount) return [];
    const line = document.getLineContent(position.line);
    const wordRange = findWordRangeAt(line, position.character);
    if (wordRange === null) return [];
    const word = line.slice(wordRange.start, wordRange.end);
    return findWholeWordMatches(document, word);
}

/** All case-sensitive, whole-word matches of `word` in document order. */
function findWholeWordMatches(document: ITextDocument, word: string): IRange[] {
    const wordLen = word.length;
    const matches: IRange[] = [];

    for (let line = 0; line < document.lineCount; line++) {
        const content = document.getLineContent(line);
        let from = 0;
        for (;;) {
            const idx = content.indexOf(word, from);
            if (idx === -1) break;
            const before = idx > 0 ? content[idx - 1] : "";
            const after = idx + wordLen < content.length ? content[idx + wordLen] : "";
            if (!isWordChar(before) && !isWordChar(after)) {
                matches.push(createRange(line, idx, line, idx + wordLen));
            }
            from = idx + wordLen; // non-overlapping
        }
    }

    return matches;
}
