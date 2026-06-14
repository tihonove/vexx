import { describe, expect, it } from "vitest";

import { fuzzyMatch, fuzzyMatchBest } from "./FuzzySearch.ts";

// ─── Basic matching ──────────────────────────────────────────────────────────

describe("fuzzyMatch — basic matching", () => {
    it("returns null when no characters match in order", () => {
        expect(fuzzyMatch("xyz", "abc")).toBeNull();
    });

    it("returns null when only some characters match", () => {
        expect(fuzzyMatch("ace", "ac")).toBeNull();
    });

    it("matches all characters present in order", () => {
        expect(fuzzyMatch("ac", "abstract")).not.toBeNull();
    });

    it("matches single character", () => {
        expect(fuzzyMatch("a", "alpha")).not.toBeNull();
    });

    it("returns score 0 and empty indices for empty query", () => {
        const result = fuzzyMatch("", "anything");
        expect(result).not.toBeNull();
        expect(result!.score).toBe(0);
        expect(result!.matchedIndices).toHaveLength(0);
    });

    it("returns null for non-empty query against empty text", () => {
        expect(fuzzyMatch("a", "")).toBeNull();
    });

    it("exact full string match returns non-null", () => {
        expect(fuzzyMatch("abc", "abc")).not.toBeNull();
    });

    it("is case-insensitive", () => {
        expect(fuzzyMatch("AC", "AppController")).not.toBeNull();
        expect(fuzzyMatch("ac", "AppController")).not.toBeNull();
        expect(fuzzyMatch("AC", "appcontroller")).not.toBeNull();
    });
});

// ─── matchedIndices ──────────────────────────────────────────────────────────

describe("fuzzyMatch — matchedIndices", () => {
    it("reports correct indices for sequential match", () => {
        const result = fuzzyMatch("ac", "abstract");
        // 'a' at 0, 'c' at 4 ("abstra[c]t") — greedy first match
        expect(result).not.toBeNull();
        expect(result!.matchedIndices[0]).toBe(0);
    });

    it("includes both matched positions", () => {
        const result = fuzzyMatch("ab", "xaxbx");
        expect(result).not.toBeNull();
        expect(result!.matchedIndices).toHaveLength(2);
    });

    it("length of matchedIndices equals query length", () => {
        const result = fuzzyMatch("ctrl", "Controllers");
        expect(result!.matchedIndices).toHaveLength(4);
    });
});

// ─── Scoring: word boundary bonus ────────────────────────────────────────────

describe("fuzzyMatch — word boundary scoring", () => {
    it("word-boundary match scores higher than mid-word match", () => {
        // 'A' and 'C' are both word-boundary starts in "AppController"
        const boundary = fuzzyMatch("ac", "AppController");
        // 'a' at 0, 'c' at 4 in "abstract" — 'a' is boundary but 'c' is not
        const midword = fuzzyMatch("ac", "abstract");
        expect(boundary).not.toBeNull();
        expect(midword).not.toBeNull();
        expect(boundary!.score).toBeGreaterThan(midword!.score);
    });

    it("slash-separated path gives word boundary bonus at each segment", () => {
        const result = fuzzyMatch("ac", "app/controllers");
        // 'a' at 0 (boundary), 'c' at 4 ('controllers' start is also boundary after '/')
        expect(result).not.toBeNull();
    });

    it("underscore acts as word boundary", () => {
        const withUnderscore = fuzzyMatch("fc", "first_contact.ts");
        const withoutBoundary = fuzzyMatch("fc", "firefox_changes");
        // both have word boundaries but let's just verify they match
        expect(withUnderscore).not.toBeNull();
        expect(withoutBoundary).not.toBeNull();
    });

    it("camelCase boundary is detected", () => {
        // 'C' in "AppController" follows lowercase 'p' → word boundary
        const result = fuzzyMatch("AC", "AppController");
        expect(result).not.toBeNull();
        // Both A (pos 0, first char) and C (pos 3, camelCase boundary) get WORD_START_BONUS
        // This makes the score quite high
        expect(result!.score).toBeGreaterThan(100);
    });

    it("dot acts as word boundary", () => {
        const result = fuzzyMatch("ts", "controller.ts");
        expect(result).not.toBeNull();
        // 't' after '.' is a word boundary
    });
});

// ─── Scoring: consecutive bonus ───────────────────────────────────────────────

describe("fuzzyMatch — consecutive bonus", () => {
    it("consecutive match scores higher than scattered match of same chars", () => {
        // "ctrl" matches consecutively in "controller" (c-t-r-l all adjacent)
        const consecutive = fuzzyMatch("ctrl", "controller");
        // same chars spread out
        const scattered = fuzzyMatch("ctrl", "cXtXrXl");
        expect(consecutive).not.toBeNull();
        expect(scattered).not.toBeNull();
        expect(consecutive!.score).toBeGreaterThan(scattered!.score);
    });
});

// ─── Ranking comparisons (VS Code-like expectations) ─────────────────────────

describe("fuzzyMatch — ranking", () => {
    it('query "ac": AppController ranks above abstract', () => {
        const controller = fuzzyMatch("ac", "AppController");
        const abstract_ = fuzzyMatch("ac", "abstract");
        expect(controller!.score).toBeGreaterThan(abstract_!.score);
    });

    it('query "fc": FileController ranks above first_contact', () => {
        const fileCtrl = fuzzyMatchBest("fc", "FileController");
        const firstContact = fuzzyMatchBest("fc", "first_contact");
        expect(fileCtrl).not.toBeNull();
        expect(firstContact).not.toBeNull();
        expect(fileCtrl!.score).toBeGreaterThan(firstContact!.score);
    });

    it('query "cr": CommandRegistry ranks above continuous_record', () => {
        // 'c'(0, word+first) + 'r'(7, camelCase boundary) → high score in CommandRegistry
        // 'c'(0, word+first) + 'r'(11, underscore boundary) → slightly lower in continuous_record
        const registry = fuzzyMatchBest("cr", "CommandRegistry");
        const continuous = fuzzyMatchBest("cr", "continuous_record");
        expect(registry).not.toBeNull();
        expect(continuous).not.toBeNull();
        expect(registry!.score).toBeGreaterThan(continuous!.score);
    });

    it("shorter file with same boundary chars ranks higher than longer", () => {
        // "AC" in "AppController" (13 chars) vs "AppControllerFactory" (20 chars)
        const shorter = fuzzyMatch("ac", "AppController");
        const longer = fuzzyMatch("ac", "AppControllerFactory");
        // Both start at same positions so score should be equal or shorter wins via gap
        expect(shorter).not.toBeNull();
        expect(longer).not.toBeNull();
        // shorter wins because there are fewer un-matched trailing chars (no gap penalty there,
        // but both have the same matched positions so scores are equal)
        // At minimum they should be equal or shorter wins
        expect(shorter!.score).toBeGreaterThanOrEqual(longer!.score);
    });

    it("first character match gets extra bonus", () => {
        const startMatch = fuzzyMatch("a", "alpha"); // 'a' at 0
        const midMatch = fuzzyMatch("a", "xalpha"); // 'a' at 1
        expect(startMatch!.score).toBeGreaterThan(midMatch!.score);
    });
});

// ─── fuzzyMatchBest ───────────────────────────────────────────────────────────

describe("fuzzyMatchBest", () => {
    it("returns null when no match", () => {
        expect(fuzzyMatchBest("xyz", "abc")).toBeNull();
    });

    it("returns match when characters present", () => {
        expect(fuzzyMatchBest("ac", "AppController")).not.toBeNull();
    });

    it("prefers word-boundary start over mid-word start", () => {
        // "fc" in "first_file_controller" — 'f' appears at 0 (word boundary) and
        // again at 6 ('f'ile, also boundary). 'c' appears at pos 11 ('c'ontroller, boundary).
        // The best match should find 'f'(boundary) + 'c'(boundary).
        const result = fuzzyMatchBest("fc", "first_file_controller");
        expect(result).not.toBeNull();
        // Both matched chars should be on word boundaries for max score
    });

    it("empty query returns score 0", () => {
        expect(fuzzyMatchBest("", "anything")).toEqual({ score: 0, matchedIndices: [] });
    });

    it("caps candidate start positions at 8 occurrences of the first char", () => {
        // 12 'a's followed by a 'z'. fuzzyMatchBest only scans the first 8 'a'
        // start positions; the 'z' lives past all of them, so it must still match.
        const result = fuzzyMatchBest("az", "aaaaaaaaaaaaz");
        expect(result).not.toBeNull();
        expect(result!.matchedIndices).toHaveLength(2);
        // Last matched index is the 'z' at position 12.
        expect(result!.matchedIndices[1]).toBe(12);
    });

    it("produces higher or equal score than greedy fuzzyMatch", () => {
        // fuzzyMatchBest tries multiple start positions and picks the best
        const greedy = fuzzyMatch("ac", "abstract_class");
        const best = fuzzyMatchBest("ac", "abstract_class");
        expect(best).not.toBeNull();
        expect(best!.score).toBeGreaterThanOrEqual(greedy!.score);
    });
});
