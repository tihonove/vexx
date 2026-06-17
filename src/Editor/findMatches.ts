import type { IRange } from "./IRange.ts";
import { createRange } from "./IRange.ts";
import type { ITextDocument } from "./ITextDocument.ts";

/**
 * Finds all case-insensitive substring matches of `query` in `document`.
 *
 * Matches are computed per line (a plain query never spans a newline),
 * non-overlapping, and returned in document order. An empty query yields no
 * matches (mirrors VS Code; a whitespace query still matches whitespace).
 */
export function findMatches(document: ITextDocument, query: string): IRange[] {
    if (query.length === 0) return [];

    const queryLower = query.toLowerCase();
    const queryLen = query.length;
    const matches: IRange[] = [];

    for (let line = 0; line < document.lineCount; line++) {
        const lineLower = document.getLineContent(line).toLowerCase();
        let from = 0;
        for (;;) {
            const idx = lineLower.indexOf(queryLower, from);
            if (idx === -1) break;
            matches.push(createRange(line, idx, line, idx + queryLen));
            from = idx + queryLen; // non-overlapping
        }
    }

    return matches;
}
