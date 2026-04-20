import { describe, expect, it } from "vitest";

import { getCharDisplayWidth, getGraphemeDisplayWidth } from "./UnicodeWidth.ts";

describe("getCharDisplayWidth", () => {
    describe("ASCII printable", () => {
        it("returns 1 for regular ASCII letters", () => {
            expect(getCharDisplayWidth(0x41)).toBe(1); // 'A'
            expect(getCharDisplayWidth(0x7a)).toBe(1); // 'z'
        });

        it("returns 1 for digits", () => {
            expect(getCharDisplayWidth(0x30)).toBe(1); // '0'
            expect(getCharDisplayWidth(0x39)).toBe(1); // '9'
        });

        it("returns 1 for space", () => {
            expect(getCharDisplayWidth(0x20)).toBe(1);
        });

        it("returns 1 for punctuation", () => {
            expect(getCharDisplayWidth(0x2e)).toBe(1); // '.'
            expect(getCharDisplayWidth(0x21)).toBe(1); // '!'
        });
    });

    describe("control characters", () => {
        it("returns 0 for NUL", () => {
            expect(getCharDisplayWidth(0x00)).toBe(0);
        });

        it("returns 0 for TAB (\\t)", () => {
            expect(getCharDisplayWidth(0x09)).toBe(0);
        });

        it("returns 0 for LF (\\n)", () => {
            expect(getCharDisplayWidth(0x0a)).toBe(0);
        });

        it("returns 0 for CR (\\r)", () => {
            expect(getCharDisplayWidth(0x0d)).toBe(0);
        });

        it("returns 0 for ESC", () => {
            expect(getCharDisplayWidth(0x1b)).toBe(0);
        });

        it("returns 0 for DEL (0x7F)", () => {
            expect(getCharDisplayWidth(0x7f)).toBe(0);
        });

        it("returns 0 for C1 control chars (0x80-0x9F)", () => {
            expect(getCharDisplayWidth(0x80)).toBe(0);
            expect(getCharDisplayWidth(0x9f)).toBe(0);
        });
    });

    describe("CJK characters", () => {
        it("returns 2 for CJK Unified Ideographs", () => {
            expect(getCharDisplayWidth(0x4e00)).toBe(2); // '一'
            expect(getCharDisplayWidth(0x6f22)).toBe(2); // '漢'
            expect(getCharDisplayWidth(0x9fff)).toBe(2);
        });

        it("returns 2 for Hiragana", () => {
            expect(getCharDisplayWidth(0x3042)).toBe(2); // 'あ'
        });

        it("returns 2 for Katakana", () => {
            expect(getCharDisplayWidth(0x30a2)).toBe(2); // 'ア'
        });

        it("returns 2 for Hangul Syllables", () => {
            expect(getCharDisplayWidth(0xac00)).toBe(2); // '가'
            expect(getCharDisplayWidth(0xd7a3)).toBe(2);
        });

        it("returns 2 for CJK Compatibility Ideographs", () => {
            expect(getCharDisplayWidth(0xf900)).toBe(2);
        });
    });

    describe("Fullwidth forms", () => {
        it("returns 2 for Fullwidth Latin capital letter A (Ａ)", () => {
            expect(getCharDisplayWidth(0xff21)).toBe(2);
        });

        it("returns 2 for Fullwidth exclamation mark (！)", () => {
            expect(getCharDisplayWidth(0xff01)).toBe(2);
        });

        it("returns 2 for Fullwidth currency symbols", () => {
            expect(getCharDisplayWidth(0xffe0)).toBe(2); // ￠
            expect(getCharDisplayWidth(0xffe1)).toBe(2); // ￡
        });
    });

    describe("Combining marks", () => {
        it("returns 0 for combining acute accent (U+0301)", () => {
            expect(getCharDisplayWidth(0x0301)).toBe(0);
        });

        it("returns 0 for combining diacritical marks range", () => {
            expect(getCharDisplayWidth(0x0300)).toBe(0);
            expect(getCharDisplayWidth(0x036f)).toBe(0);
        });

        it("returns 0 for combining marks for symbols", () => {
            expect(getCharDisplayWidth(0x20d0)).toBe(0);
            expect(getCharDisplayWidth(0x20ff)).toBe(0);
        });
    });

    describe("Zero-width characters", () => {
        it("returns 0 for ZWJ (U+200D)", () => {
            expect(getCharDisplayWidth(0x200d)).toBe(0);
        });

        it("returns 0 for ZWNJ (U+200C)", () => {
            expect(getCharDisplayWidth(0x200c)).toBe(0);
        });

        it("returns 0 for ZWSP (U+200B)", () => {
            expect(getCharDisplayWidth(0x200b)).toBe(0);
        });

        it("returns 0 for BOM (U+FEFF)", () => {
            expect(getCharDisplayWidth(0xfeff)).toBe(0);
        });

        it("returns 0 for Soft Hyphen (U+00AD)", () => {
            expect(getCharDisplayWidth(0x00ad)).toBe(0);
        });

        it("returns 0 for variation selectors", () => {
            expect(getCharDisplayWidth(0xfe0f)).toBe(0); // VS16 (emoji presentation)
            expect(getCharDisplayWidth(0xfe0e)).toBe(0); // VS15 (text presentation)
        });
    });

    describe("Emoji code points", () => {
        it("returns 2 for emoji in Emoticons range", () => {
            expect(getCharDisplayWidth(0x1f600)).toBe(2); // 😀
            expect(getCharDisplayWidth(0x1f64f)).toBe(2);
        });

        it("returns 2 for emoji in Misc Symbols and Pictographs", () => {
            expect(getCharDisplayWidth(0x1f300)).toBe(2); // 🌀
            expect(getCharDisplayWidth(0x1f5ff)).toBe(2);
        });

        it("returns 2 for emoji in Transport and Map Symbols", () => {
            expect(getCharDisplayWidth(0x1f680)).toBe(2); // 🚀
        });

        it("returns 2 for emoji in Supplemental Symbols", () => {
            expect(getCharDisplayWidth(0x1f900)).toBe(2);
        });
    });

    describe("CJK extensions (SIP)", () => {
        it("returns 2 for CJK Unified Ideographs Extension B", () => {
            expect(getCharDisplayWidth(0x20000)).toBe(2);
        });
    });

    describe("Regular non-ASCII", () => {
        it("returns 1 for Latin Extended characters", () => {
            expect(getCharDisplayWidth(0x00e9)).toBe(1); // 'é' (precomposed)
            expect(getCharDisplayWidth(0x00f1)).toBe(1); // 'ñ'
        });

        it("returns 1 for Cyrillic", () => {
            expect(getCharDisplayWidth(0x0410)).toBe(1); // 'А'
            expect(getCharDisplayWidth(0x044f)).toBe(1); // 'я'
        });

        it("returns 1 for Greek", () => {
            expect(getCharDisplayWidth(0x03b1)).toBe(1); // 'α'
        });
    });
});

/**
 * Text-presentation emoji (Emoji_Presentation = No).
 * Without VS16 (U+FE0F) terminals render these as width 1.
 * With VS16 they switch to emoji presentation → width 2.
 */
describe("text-presentation emoji (Emoji_Presentation = No)", () => {
    // U+1F3D7 🏗  BUILDING CONSTRUCTION — in range 1F300-1F5FF but
    // Emoji_Presentation=No, so terminals render it as width 1 without VS16.
    it("🏗 U+1F3D7 without VS16: getCharDisplayWidth returns 1", () => {
        expect(getCharDisplayWidth(0x1f3d7)).toBe(1);
    });

    it("🏗 U+1F3D7 without VS16: getGraphemeDisplayWidth returns 1", () => {
        expect(getGraphemeDisplayWidth("\u{1F3D7}")).toBe(1);
    });

    it("🏗️ U+1F3D7 + VS16: getGraphemeDisplayWidth returns 2", () => {
        // VS16 (U+FE0F) forces emoji presentation → terminal renders as wide
        expect(getGraphemeDisplayWidth("\u{1F3D7}\uFE0F")).toBe(2);
    });

    // Other text-presentation symbols in same block
    it("U+1F321 THERMOMETER without VS16: getCharDisplayWidth returns 1", () => {
        expect(getCharDisplayWidth(0x1f321)).toBe(1);
    });

    it("U+1F324 CLOUD WITH SMALL SUN without VS16: getCharDisplayWidth returns 1", () => {
        expect(getCharDisplayWidth(0x1f324)).toBe(1);
    });

    // Make sure true emoji in the same block still return 2
    it("🌀 U+1F300 CYCLONE (Emoji_Presentation=Yes): getCharDisplayWidth returns 2", () => {
        expect(getCharDisplayWidth(0x1f300)).toBe(2);
    });

    it("🎃 U+1F383 JACK-O-LANTERN (Emoji_Presentation=Yes): getCharDisplayWidth returns 2", () => {
        expect(getCharDisplayWidth(0x1f383)).toBe(2);
    });
});

describe("getGraphemeDisplayWidth", () => {
    it("returns 1 for a single ASCII char", () => {
        expect(getGraphemeDisplayWidth("A")).toBe(1);
    });

    it("returns 2 for a CJK character", () => {
        expect(getGraphemeDisplayWidth("漢")).toBe(2);
    });

    it("returns 2 for a simple emoji", () => {
        expect(getGraphemeDisplayWidth("😀")).toBe(2);
    });

    it("returns 1 for a base + combining mark cluster", () => {
        expect(getGraphemeDisplayWidth("e\u0301")).toBe(1); // e + ◌́
    });

    it("returns 2 for ZWJ emoji sequence", () => {
        // 👨‍👩‍👧‍👦 = 👨 + ZWJ + 👩 + ZWJ + 👧 + ZWJ + 👦
        expect(getGraphemeDisplayWidth("👨\u200d👩\u200d👧\u200d👦")).toBe(2);
    });

    it("returns 2 for emoji with skin tone modifier", () => {
        expect(getGraphemeDisplayWidth("👍🏽")).toBe(2);
    });

    it("returns 0 for empty string", () => {
        expect(getGraphemeDisplayWidth("")).toBe(0);
    });
});
