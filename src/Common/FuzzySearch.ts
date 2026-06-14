/**
 * VS Code-like fuzzy matching with word-boundary and consecutive bonuses.
 *
 * Scoring constants are tuned so that:
 *   - matches at word boundaries ("AC" → "AppController") beat sequential
 *     matches in the middle of a word ("AC" → "abstract")
 *   - consecutive matched characters beat scattered ones
 *   - a match on the basename beats a match only in the directory path
 */

export interface FuzzyMatch {
    score: number;
    /** Indices into `text` (lowercase normalised) that were matched. */
    matchedIndices: readonly number[];
}

const WORD_START_BONUS = 80;
const CONSECUTIVE_BONUS = 40;
const FIRST_CHAR_BONUS = 60;
const GAP_PENALTY = 1;

/**
 * Returns true if position `i` in `text` is the start of a "word" for
 * scoring purposes.  A word boundary occurs:
 *  - at index 0
 *  - after a path separator, dash, underscore, dot, or space
 *  - at an uppercase letter preceded by a lowercase letter (camelCase)
 */
function isWordBoundary(text: string, i: number): boolean {
    if (i === 0) return true;
    const prev = text[i - 1];
    if ("/\\-_.  ".includes(prev)) return true;
    const cur = text[i];
    // camelCase: lowercase → uppercase transition
    if (cur >= "A" && cur <= "Z" && prev >= "a" && prev <= "z") return true;
    return false;
}

/**
 * Greedy sequential fuzzy match of `query` inside `text`.
 *
 * Returns `null` if not all characters of `query` can be found in order.
 * Empty query always matches with score 0.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
    if (query.length === 0) {
        return { score: 0, matchedIndices: [] };
    }
    return fuzzyMatchLower(query.toLowerCase(), text, text.toLowerCase());
}

/**
 * Picks the better of two candidate match positions for the first query
 * character.  When the greedy algorithm lands on a low-value position,
 * we scan ahead looking for a word-boundary occurrence and compare scores.
 *
 * This is a lightweight "best-of-two" heuristic — not full backtracking.
 */
export function fuzzyMatchBest(query: string, text: string): FuzzyMatch | null {
    if (query.length === 0) return { score: 0, matchedIndices: [] };
    return fuzzyMatchBestLower(query.toLowerCase(), text, text.toLowerCase());
}

/**
 * Same as `fuzzyMatch` but takes a pre-lowercased query and text. This avoids
 * re-allocating lowercase strings on every call — the hot path (file search)
 * pre-computes `textLower` once per entry at index-build time and lowercases the
 * query once per keystroke. `text` (original case) is still needed for
 * word-boundary/camelCase scoring.
 */
export function fuzzyMatchLower(queryLower: string, text: string, textLower: string): FuzzyMatch | null {
    if (queryLower.length === 0) {
        return { score: 0, matchedIndices: [] };
    }

    const matchedIndices: number[] = [];
    let ti = 0;
    for (const ch of queryLower) {
        let found = false;
        while (ti < textLower.length) {
            if (textLower[ti] === ch) {
                matchedIndices.push(ti);
                ti++;
                found = true;
                break;
            }
            ti++;
        }
        if (!found) return null;
    }

    return { score: scoreMatch(text, matchedIndices), matchedIndices };
}

/**
 * Same as `fuzzyMatchBest` but takes a pre-lowercased query and text.
 * See {@link fuzzyMatchLower} for why this matters on the hot path.
 */
export function fuzzyMatchBestLower(queryLower: string, text: string, textLower: string): FuzzyMatch | null {
    if (queryLower.length === 0) return { score: 0, matchedIndices: [] };

    const qFirst = queryLower[0];

    // Collect candidate start positions for the first character
    const candidates: number[] = [];
    for (let i = 0; i < textLower.length; i++) {
        if (textLower[i] === qFirst) {
            candidates.push(i);
            // Don't bother trying more than 8 starting positions
            if (candidates.length >= 8) break;
        }
    }

    if (candidates.length === 0) return null;

    let best: FuzzyMatch | null = null;
    for (const start of candidates) {
        const result = fuzzyMatchFromLower(queryLower, text, textLower, start);
        if (result !== null && (best === null || result.score > best.score)) {
            best = result;
        }
    }
    return best;
}

/**
 * Like `fuzzyMatchLower` but forces the first matched index to be `startAt`.
 * Returns null if remaining characters cannot be matched.
 */
function fuzzyMatchFromLower(
    queryLower: string,
    text: string,
    textLower: string,
    startAt: number,
): FuzzyMatch | null {
    /* v8 ignore next -- defensive: the only caller passes startAt positions where textLower[startAt] already equals queryLower[0] */
    if (textLower[startAt] !== queryLower[0]) return null;

    const matchedIndices: number[] = [startAt];
    let ti = startAt + 1;

    for (let qi = 1; qi < queryLower.length; qi++) {
        const ch = queryLower[qi];
        let found = false;
        while (ti < textLower.length) {
            if (textLower[ti] === ch) {
                matchedIndices.push(ti);
                ti++;
                found = true;
                break;
            }
            ti++;
        }
        if (!found) return null;
    }

    return { score: scoreMatch(text, matchedIndices), matchedIndices };
}

/**
 * Scores a set of matched positions in `text` (original case) using gap
 * penalties and word-boundary / first-char / consecutive bonuses.
 */
function scoreMatch(text: string, matchedIndices: readonly number[]): number {
    let score = 0;
    let prevMatched = -1;

    for (let i = 0; i < matchedIndices.length; i++) {
        const pos = matchedIndices[i];

        // Gap penalty: characters between previous match and this one
        const gapFrom = i === 0 ? 0 : prevMatched + 1;
        const gap = pos - gapFrom;
        score -= gap * GAP_PENALTY;

        // Position bonuses
        if (pos === 0) score += FIRST_CHAR_BONUS;
        if (isWordBoundary(text, pos)) score += WORD_START_BONUS;
        if (prevMatched !== -1 && pos === prevMatched + 1) score += CONSECUTIVE_BONUS;

        prevMatched = pos;
    }

    return score;
}
