import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";
import { abbreviatePath, truncateEnd, truncateMiddle } from "./TextTruncation.ts";

const w = (s: string): number => new DisplayLine(s).displayWidth;

// ─── truncateEnd ──────────────────────────────────────────────────────────────

describe("truncateEnd", () => {
    it("returns text unchanged when it fits", () => {
        expect(truncateEnd("main.ts", 10)).toBe("main.ts");
        expect(truncateEnd("main.ts", 7)).toBe("main.ts");
    });

    it("puts the ellipsis at the end and never exceeds maxWidth", () => {
        expect(truncateEnd("VeryLongFileName.ts", 10)).toBe("VeryLongF…");
        expect(w(truncateEnd("VeryLongFileName.ts", 10))).toBeLessThanOrEqual(10);
    });

    it("preserves the kept prefix verbatim", () => {
        const out = truncateEnd("abcdefgh", 5);
        expect(out).toBe("abcd…");
    });

    it("returns the ellipsis alone when only its width is available", () => {
        expect(truncateEnd("abcdef", 1)).toBe("…");
    });

    it("returns empty string when even the ellipsis does not fit", () => {
        expect(truncateEnd("abcdef", 0)).toBe("");
    });

    it("clamps wide characters without overflowing", () => {
        // each CJK char is width 2
        const out = truncateEnd("世界世界世界", 5);
        expect(w(out)).toBeLessThanOrEqual(5);
        expect(out.endsWith("…")).toBe(true);
    });
});

// ─── truncateMiddle ─────────────────────────────────────────────────────────

describe("truncateMiddle", () => {
    it("returns text unchanged when it fits", () => {
        expect(truncateMiddle("main.ts", 10)).toBe("main.ts");
    });

    it("puts the ellipsis in the middle", () => {
        expect(truncateMiddle("abcdefgh", 5)).toBe("ab…gh");
        expect(truncateMiddle("abcdefghij", 7)).toBe("abc…hij");
    });

    it("never exceeds maxWidth", () => {
        expect(w(truncateMiddle("abcdefghijklmnop", 9))).toBeLessThanOrEqual(9);
    });

    it("returns the ellipsis alone when only its width is available", () => {
        expect(truncateMiddle("abcdef", 1)).toBe("…");
    });

    it("returns empty string when even the ellipsis does not fit", () => {
        expect(truncateMiddle("abcdef", 0)).toBe("");
    });
});

// ─── abbreviatePath ─────────────────────────────────────────────────────────

describe("abbreviatePath — fitting paths are untouched", () => {
    it("returns the path unchanged when it fits", () => {
        expect(abbreviatePath("src/components/widgets", 100)).toBe("src/components/widgets");
        expect(abbreviatePath("aa/bb/cc/dd/ee", 14)).toBe("aa/bb/cc/dd/ee");
    });
});

describe("abbreviatePath — keeps first + last, fills from the 2nd, ellipsis in the middle", () => {
    // path "aa/bb/cc/dd/ee" has full width 14.
    // candidates (by visible prefix length):
    //   aa/…/ee            (7)
    //   aa/bb/…/ee         (10)
    //   aa/bb/cc/…/ee      (13)
    const path = "aa/bb/cc/dd/ee";

    it("shows as many leading segments as fit (widest)", () => {
        expect(abbreviatePath(path, 13)).toBe("aa/bb/cc/…/ee");
    });

    it("drops trailing-of-prefix segments as width shrinks", () => {
        expect(abbreviatePath(path, 12)).toBe("aa/bb/…/ee");
        expect(abbreviatePath(path, 10)).toBe("aa/bb/…/ee");
    });

    it("falls back to first + last only", () => {
        expect(abbreviatePath(path, 9)).toBe("aa/…/ee");
        expect(abbreviatePath(path, 7)).toBe("aa/…/ee");
    });

    it("always keeps the first and last segment visible", () => {
        const out = abbreviatePath(path, 13);
        expect(out.startsWith("aa/")).toBe(true);
        expect(out.endsWith("/ee")).toBe(true);
        expect(out).toContain("…");
    });

    it("never exceeds maxWidth across a range of widths", () => {
        for (let max = 4; max <= 14; max++) {
            expect(w(abbreviatePath(path, max))).toBeLessThanOrEqual(max);
        }
    });
});

describe("abbreviatePath — narrow-width degradation", () => {
    const path = "aa/bb/cc/dd/ee";

    it("drops to '…/last' when even first/…/last does not fit", () => {
        expect(abbreviatePath(path, 6)).toBe("…/ee");
        expect(abbreviatePath(path, 4)).toBe("…/ee");
    });

    it("middle-truncates the last segment when '…/last' does not fit", () => {
        // maxWidth 1: only the ellipsis fits
        expect(abbreviatePath(path, 1)).toBe("…");
    });
});

describe("abbreviatePath — few segments", () => {
    it("middle-truncates a single long segment", () => {
        expect(abbreviatePath("VeryLongSingleSegment", 9)).toBe(truncateMiddle("VeryLongSingleSegment", 9));
        expect(w(abbreviatePath("VeryLongSingleSegment", 9))).toBeLessThanOrEqual(9);
    });

    it("middle-truncates a two-segment path (no useful ellipsis split)", () => {
        const out = abbreviatePath("source/componentsdir", 12);
        expect(out).toBe(truncateMiddle("source/componentsdir", 12));
        expect(w(out)).toBeLessThanOrEqual(12);
    });
});

describe("abbreviatePath — three segments", () => {
    it("hides the single middle segment", () => {
        // full "aaa/bbb/ccc" = 11; base "aaa/…/ccc" = 9
        expect(abbreviatePath("aaa/bbb/ccc", 10)).toBe("aaa/…/ccc");
    });
});

describe("abbreviatePath — wide characters", () => {
    it("stays within maxWidth with CJK segments", () => {
        const path = "世界/components/popups/メニュー";
        for (let max = 5; max <= 20; max++) {
            expect(w(abbreviatePath(path, max))).toBeLessThanOrEqual(max);
        }
    });
});
