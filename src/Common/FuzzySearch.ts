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

    const qLower = query.toLowerCase();
    const tLower = text.toLowerCase();

    const matchedIndices: number[] = [];
    let ti = 0;
    for (let qi = 0; qi < qLower.length; qi++) {
        const ch = qLower[qi];
        let found = false;
        while (ti < tLower.length) {
            if (tLower[ti] === ch) {
                matchedIndices.push(ti);
                ti++;
                found = true;
                break;
            }
            ti++;
        }
        if (!found) return null;
    }

    // Score the matched positions
    let score = 0;
    let prevMatched = -1;
    let gapStart = 0;

    for (let i = 0; i < matchedIndices.length; i++) {
        const pos = matchedIndices[i];

        // Gap penalty: characters between previous match and this one
        const gapFrom = i === 0 ? gapStart : prevMatched + 1;
        const gap = pos - gapFrom;
        score -= gap * GAP_PENALTY;

        // Position bonuses
        if (pos === 0) score += FIRST_CHAR_BONUS;
        if (isWordBoundary(text, pos)) score += WORD_START_BONUS;
        if (prevMatched !== -1 && pos === prevMatched + 1) score += CONSECUTIVE_BONUS;

        prevMatched = pos;
    }

    return { score, matchedIndices };
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

    const tLower = text.toLowerCase();
    const qFirst = query[0].toLowerCase();

    // Collect candidate start positions for the first character
    const candidates: number[] = [];
    for (let i = 0; i < tLower.length; i++) {
        if (tLower[i] === qFirst) {
            candidates.push(i);
            // Don't bother trying more than 8 starting positions
            if (candidates.length >= 8) break;
        }
    }

    if (candidates.length === 0) return null;

    let best: FuzzyMatch | null = null;
    for (const start of candidates) {
        const result = fuzzyMatchFrom(query, text, start);
        if (result !== null && (best === null || result.score > best.score)) {
            best = result;
        }
    }
    return best;
}

/**
 * Like `fuzzyMatch` but forces the first matched index to be `startAt`.
 * Returns null if `text[startAt]` does not match `query[0]` (case-insensitive)
 * or if remaining characters cannot be matched.
 */
function fuzzyMatchFrom(query: string, text: string, startAt: number): FuzzyMatch | null {
    const qLower = query.toLowerCase();
    const tLower = text.toLowerCase();

    if (tLower[startAt] !== qLower[0]) return null;

    const matchedIndices: number[] = [startAt];
    let ti = startAt + 1;

    for (let qi = 1; qi < qLower.length; qi++) {
        const ch = qLower[qi];
        let found = false;
        while (ti < tLower.length) {
            if (tLower[ti] === ch) {
                matchedIndices.push(ti);
                ti++;
                found = true;
                break;
            }
            ti++;
        }
        if (!found) return null;
    }

    let score = 0;
    let prevMatched = -1;

    for (let i = 0; i < matchedIndices.length; i++) {
        const pos = matchedIndices[i];
        const gapFrom = i === 0 ? 0 : prevMatched + 1;
        const gap = pos - gapFrom;
        score -= gap * GAP_PENALTY;
        if (pos === 0) score += FIRST_CHAR_BONUS;
        if (isWordBoundary(text, pos)) score += WORD_START_BONUS;
        if (prevMatched !== -1 && pos === prevMatched + 1) score += CONSECUTIVE_BONUS;
        prevMatched = pos;
    }

    return { score, matchedIndices };
}
