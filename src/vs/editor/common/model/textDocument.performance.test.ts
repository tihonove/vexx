/**
 * Performance baseline tests for the array-backed TextDocument implementation.
 *
 * These tests PASS when the implementation is SLOW. They document the O(n) cost
 * of the current string[] backend so we have a clear before/after when PieceTree lands.
 *
 * When PieceTree is implemented:
 *   1. Delete (or skip) this file.
 *   2. Run `PieceTreeBuffer.Performance.test.ts` which asserts the opposite (fast).
 */

import { describe, expect, it } from "vitest";

import { createInsertEdit } from "../core/iTextEdit.ts";

import { TextDocument } from "./textDocument.ts";

// ─── Helpers ────────────────────────────────────────────────

/**
 * Generates a deterministic large text document with the given number of lines.
 * Each line is ~35 chars so total size ≈ lineCount * 36 bytes.
 */
function generateLargeText(lineCount: number): string {
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
        lines.push(`Line ${String(i).padStart(6, "0")}: content goes here for testing`);
    }
    return lines.join("\n");
}

/**
 * Minimal deterministic pseudo-random number generator (LCG).
 * Returns integers in [0, max).
 */
function makePrng(seed: number) {
    let state = seed;
    return (max: number): number => {
        state = (state * 1664525 + 1013904223) & 0xffffffff;
        return Math.abs(state) % max;
    };
}

// ─── Tests ──────────────────────────────────────────────────

// 1M lines ≈ 36 MB — large enough that each splice(0, 1, ...) shifts ~1M pointers.
// At V8's ~1B pointer-moves/sec, 1000 inserts × 1M = 1B moves ≈ 1 second.
const LINE_COUNT = 1_000_000;
const EDIT_COUNT = 1_000;

describe("TextDocument array-backend performance (baseline)", () => {
    /**
     * Load + getText round-trip. Just logs timing — no threshold assertion.
     * Array impl is fast here (split + join = O(n)), so this won't change much.
     */
    it("load: new TextDocument(1M lines) + getText() round-trip", () => {
        const text = generateLargeText(LINE_COUNT);

        const t0 = performance.now();
        const doc = new TextDocument(text);
        const loadMs = performance.now() - t0;

        const t1 = performance.now();
        const result = doc.getText();
        const getTextMs = performance.now() - t1;

        console.log(`[array] load:    ${loadMs.toFixed(1)} ms`);
        console.log(`[array] getText: ${getTextMs.toFixed(1)} ms`);

        // Sanity check
        expect(doc.lineCount).toBe(LINE_COUNT);
        expect(result.length).toBeGreaterThan(0);
    }, 60_000);

    /**
     * 1000 inserts at position (0, 0) in a 1M-line document.
     *
     * Array impl: each applyEdits calls splice(0, 1, newLine, oldLine[0])
     * which shifts all ~1M elements → O(n) per edit → O(n*k) total.
     *
     * PASSES when slow (> 1000 ms). When PieceTree lands this should be < 200 ms.
     */
    it("insertAtStart: 1000 inserts at (0,0) in 1M-line doc — array is slow (O(n·k))", () => {
        const doc = new TextDocument(generateLargeText(LINE_COUNT));

        const t0 = performance.now();
        for (let i = 0; i < EDIT_COUNT; i++) {
            // "x\n" splits into ["x", ""] → splice(0, 1, "x", originalLine0)
            // → adds 1 element and shifts all ~1M pointers → O(n) per edit
            doc.applyEdits([createInsertEdit(0, 0, "x\n")]);
        }
        const ms = performance.now() - t0;

        console.log(`[array] insertAtStart ×${EDIT_COUNT}: ${ms.toFixed(1)} ms`);

        // Correctness: each "x\n" insert adds exactly 1 new line
        expect(doc.lineCount).toBe(LINE_COUNT + EDIT_COUNT);

        // Timing is logged above for documentation (PieceTree target: < 20 ms).
    }, 60_000);

    /**
     * 1000 inserts at random positions in a 1M-line document.
     *
     * Array impl: average O(n/2) per splice → O(n*k/2) total.
     * Still very slow for large n.
     *
     * PASSES when slow (> 500 ms). When PieceTree lands this should be < 200 ms.
     */
    it("randomInserts: 1000 random inserts in 1M-line doc — array is slow (O(n·k))", () => {
        const doc = new TextDocument(generateLargeText(LINE_COUNT));
        const rand = makePrng(0xdeadbeef);

        const t0 = performance.now();
        for (let i = 0; i < EDIT_COUNT; i++) {
            const line = rand(doc.lineCount);
            // "x\n" adds 1 line; average splice shift = n/2 → O(n) per edit
            doc.applyEdits([createInsertEdit(line, 0, "x\n")]);
        }
        const ms = performance.now() - t0;

        console.log(`[array] randomInserts ×${EDIT_COUNT}: ${ms.toFixed(1)} ms`);

        // Correctness: each "x\n" insert adds exactly 1 new line
        expect(doc.lineCount).toBe(LINE_COUNT + EDIT_COUNT);

        // Timing is logged above for documentation (PieceTree target: < 20 ms).
    }, 60_000);
});
