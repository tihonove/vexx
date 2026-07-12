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

        it("returns 0 for Combining Grapheme Joiner (U+034F)", () => {
            expect(getCharDisplayWidth(0x034f)).toBe(0);
        });

        it("returns 0 for Combining Diacritical Marks Extended (U+1AB0..U+1AFF)", () => {
            expect(getCharDisplayWidth(0x1ab0)).toBe(0);
            expect(getCharDisplayWidth(0x1aff)).toBe(0);
        });

        it("returns 0 for Combining Diacritical Marks Supplement (U+1DC0..U+1DFF)", () => {
            expect(getCharDisplayWidth(0x1dc0)).toBe(0);
            expect(getCharDisplayWidth(0x1dff)).toBe(0);
        });

        it("returns 0 for Combining Half Marks (U+FE20..U+FE2F)", () => {
            expect(getCharDisplayWidth(0xfe20)).toBe(0);
            expect(getCharDisplayWidth(0xfe2f)).toBe(0);
        });
    });

    describe("script-specific combining marks", () => {
        it("returns 0 for Thai combining marks", () => {
            expect(getCharDisplayWidth(0x0e31)).toBe(0);
            expect(getCharDisplayWidth(0x0e3a)).toBe(0);
            expect(getCharDisplayWidth(0x0e47)).toBe(0);
            expect(getCharDisplayWidth(0x0e4e)).toBe(0);
        });

        it("returns 0 for Hebrew points", () => {
            expect(getCharDisplayWidth(0x0591)).toBe(0);
            expect(getCharDisplayWidth(0x05bd)).toBe(0);
            expect(getCharDisplayWidth(0x05bf)).toBe(0);
            expect(getCharDisplayWidth(0x05c1)).toBe(0);
            expect(getCharDisplayWidth(0x05c4)).toBe(0);
            expect(getCharDisplayWidth(0x05c7)).toBe(0);
        });

        it("returns 0 for Arabic combining marks", () => {
            expect(getCharDisplayWidth(0x0610)).toBe(0);
            expect(getCharDisplayWidth(0x061a)).toBe(0);
            expect(getCharDisplayWidth(0x064b)).toBe(0);
            expect(getCharDisplayWidth(0x065f)).toBe(0);
            expect(getCharDisplayWidth(0x0670)).toBe(0);
            expect(getCharDisplayWidth(0x06d6)).toBe(0);
            expect(getCharDisplayWidth(0x06df)).toBe(0);
            expect(getCharDisplayWidth(0x06e7)).toBe(0);
            expect(getCharDisplayWidth(0x06ea)).toBe(0);
        });

        it("returns 0 for Devanagari combining marks", () => {
            expect(getCharDisplayWidth(0x0900)).toBe(0);
            expect(getCharDisplayWidth(0x093a)).toBe(0);
            expect(getCharDisplayWidth(0x094f)).toBe(0);
            expect(getCharDisplayWidth(0x0951)).toBe(0);
            expect(getCharDisplayWidth(0x0957)).toBe(0);
        });

        it("returns 0 for Hangul Jamo medial/final (U+1160..U+11FF)", () => {
            expect(getCharDisplayWidth(0x1160)).toBe(0);
            expect(getCharDisplayWidth(0x11ff)).toBe(0);
        });

        it("returns 0 for variation selectors supplement (U+E0100..U+E01EF)", () => {
            expect(getCharDisplayWidth(0xe0100)).toBe(0);
            expect(getCharDisplayWidth(0xe01ef)).toBe(0);
        });

        it("returns 0 for Word Joiner (U+2060)", () => {
            expect(getCharDisplayWidth(0x2060)).toBe(0);
        });
    });

    describe("more wide ranges", () => {
        it("returns 2 for CJK Radicals Supplement / Kangxi", () => {
            expect(getCharDisplayWidth(0x2e80)).toBe(2);
            expect(getCharDisplayWidth(0x2fdf)).toBe(2);
        });

        it("returns 2 for CJK Symbols and Punctuation", () => {
            expect(getCharDisplayWidth(0x2ff0)).toBe(2);
            expect(getCharDisplayWidth(0x303e)).toBe(2);
        });

        it("returns 2 for Bopomofo / Kanbun block", () => {
            expect(getCharDisplayWidth(0x3040)).toBe(2);
            expect(getCharDisplayWidth(0x33bf)).toBe(2);
            expect(getCharDisplayWidth(0x33c0)).toBe(2);
            expect(getCharDisplayWidth(0x4dbf)).toBe(2);
        });

        it("returns 2 for Yi Syllables", () => {
            expect(getCharDisplayWidth(0xa000)).toBe(2);
            expect(getCharDisplayWidth(0xa4cf)).toBe(2);
        });

        it("returns 2 for Vertical Forms and CJK Compatibility Forms", () => {
            expect(getCharDisplayWidth(0xfe10)).toBe(2);
            expect(getCharDisplayWidth(0xfe19)).toBe(2);
            expect(getCharDisplayWidth(0xfe30)).toBe(2);
            expect(getCharDisplayWidth(0xfe6f)).toBe(2);
        });

        it("returns 2 for the upper end of the SIP CJK extensions", () => {
            expect(getCharDisplayWidth(0x3134f)).toBe(2);
        });

        it("returns 2 for assorted emoji blocks", () => {
            expect(getCharDisplayWidth(0x1f32d)).toBe(2); // hot dog
            expect(getCharDisplayWidth(0x1f3f4)).toBe(2); // black flag
            expect(getCharDisplayWidth(0x1f440)).toBe(2); // eyes
            expect(getCharDisplayWidth(0x1f54b)).toBe(2); // kaaba
            expect(getCharDisplayWidth(0x1f5a4)).toBe(2); // black heart
            expect(getCharDisplayWidth(0x1f6d0)).toBe(2); // place of worship
            expect(getCharDisplayWidth(0x1fa00)).toBe(2); // chess pawn block
            expect(getCharDisplayWidth(0x1fa70)).toBe(2); // ballet shoes block
            expect(getCharDisplayWidth(0x2705)).toBe(2); // ✅ dingbat (Emoji_Presentation=Yes)
            expect(getCharDisplayWidth(0x1f100)).toBe(2); // enclosed alphanumeric supplement
        });

        it("returns 1 for narrow Dingbats (Emoji_Presentation=No text symbols)", () => {
            // The Dingbats block (2700–27BF) is mostly narrow text symbols; only a
            // handful of code points default to emoji presentation. Regression guard
            // for the find widget's ✕ close glyph drifting the right border.
            expect(getCharDisplayWidth(0x2715)).toBe(1); // ✕ MULTIPLICATION X
            expect(getCharDisplayWidth(0x2713)).toBe(1); // ✓ CHECK MARK
            expect(getCharDisplayWidth(0x2700)).toBe(1); // ✀ (block start, non-emoji)
            expect(getCharDisplayWidth(0x274c)).toBe(2); // ❌ stays wide (Emoji_Presentation=Yes)
        });

        it("returns 1 for text-default neighbours of BMP emoji", () => {
            // Symbols adjacent to the Emoji_Presentation=Yes ranges but themselves
            // text-default (Emoji_Presentation=No) must stay narrow — over-widening
            // them would desync the column model just like the ⭐/⚡ omission did.
            expect(getCharDisplayWidth(0x2600)).toBe(1); // ☀ BLACK SUN WITH RAYS
            expect(getCharDisplayWidth(0x26a0)).toBe(1); // ⚠ WARNING SIGN
            expect(getCharDisplayWidth(0x25cf)).toBe(1); // ● BLACK CIRCLE
            expect(getCharDisplayWidth(0x25b6)).toBe(1); // ▶ BLACK RIGHT-POINTING TRIANGLE
            expect(getCharDisplayWidth(0x2b51)).toBe(1); // ⭑ BLACK SMALL STAR
        });
    });

    describe("emoji Emoji_Presentation sub-ranges", () => {
        // Each entry covers one explicit Emoji_Presentation=Yes sub-range in
        // isWide(). Both endpoints are checked to pin down range boundaries.
        const ranges: [number, number, string][] = [
            [0x1f337, 0x1f37c, "food / plants"],
            [0x1f3a0, 0x1f3ca, "entertainment"],
            [0x1f3cf, 0x1f3d3, "sports"],
            [0x1f3e0, 0x1f3f0, "buildings"],
            [0x1f4ff, 0x1f53d, "more objects"],
            [0x1f550, 0x1f567, "clocks"],
            [0x1f595, 0x1f596, "hand gestures"],
            [0x1f6cc, 0x1f6cc, "🛌 sleeping accommodation"],
            [0x1f6d5, 0x1f6d7, "transport/map"],
            [0x1f6dc, 0x1f6dc, "🛜 wireless"],
            [0x1f6dd, 0x1f6df, "transport/map"],
            [0x1f6eb, 0x1f6ec, "transport/map"],
            [0x1f6f4, 0x1f6fc, "transport/map"],
            [0x1f7e0, 0x1f7eb, "🟠🟢 colored circles / squares"],
            [0x1f7f0, 0x1f7f0, "🟰 heavy equals sign"],
            [0x1f004, 0x1f004, "🀄 mahjong red dragon"],
            [0x1f0cf, 0x1f0cf, "🃏 playing card joker"],
            [0x1f201, 0x1f201, "🈁 squared katakana koko"],
            [0x1f21a, 0x1f21a, "🈚 squared 7121"],
            [0x1f22f, 0x1f22f, "🈯 squared 6307"],
            [0x1f232, 0x1f236, "🈲 squared CJK"],
            [0x1f238, 0x1f23a, "🈸 squared CJK"],
            [0x1f250, 0x1f251, "🉐🉑 circled ideograph"],
            // Emoji_Presentation=Yes code points inside the Dingbats block (2700–27BF).
            [0x2705, 0x2705, "✅ check mark"],
            [0x270a, 0x270b, "✊✋ fist / hand"],
            [0x2728, 0x2728, "✨ sparkles"],
            [0x274c, 0x274c, "❌ cross mark"],
            [0x274e, 0x274e, "❎ negative cross"],
            [0x2753, 0x2755, "❓❔❕ question / exclamation"],
            [0x2757, 0x2757, "❗ heavy exclamation"],
            [0x2795, 0x2797, "➕➖➗ heavy math"],
            [0x27b0, 0x27bf, "➰➿ curly loops"],
            // BMP Emoji_Presentation=Yes outside Dingbats — Misc Technical,
            // Misc Symbols (2600–26FF), Geometric Shapes and the 2B00 block.
            [0x231a, 0x231b, "⌚⌛ watch / hourglass"],
            [0x23e9, 0x23ec, "⏩⏪⏫⏬ fast-forward / rewind"],
            [0x23f0, 0x23f0, "⏰ alarm clock"],
            [0x23f3, 0x23f3, "⏳ hourglass with sand"],
            [0x25fd, 0x25fe, "◽◾ medium-small squares"],
            [0x2614, 0x2615, "☔☕ umbrella / hot beverage"],
            [0x2648, 0x2653, "♈..♓ zodiac signs"],
            [0x267f, 0x267f, "♿ wheelchair"],
            [0x2693, 0x2693, "⚓ anchor"],
            [0x26a1, 0x26a1, "⚡ high voltage"],
            [0x26aa, 0x26ab, "⚪⚫ medium circles"],
            [0x26bd, 0x26be, "⚽⚾ soccer / baseball"],
            [0x26c4, 0x26c5, "⛄⛅ snowman / sun behind cloud"],
            [0x26ce, 0x26ce, "⛎ ophiuchus"],
            [0x26d4, 0x26d4, "⛔ no entry"],
            [0x26ea, 0x26ea, "⛪ church"],
            [0x26f2, 0x26f3, "⛲⛳ fountain / flag in hole"],
            [0x26f5, 0x26f5, "⛵ sailboat"],
            [0x26fa, 0x26fa, "⛺ tent"],
            [0x26fd, 0x26fd, "⛽ fuel pump"],
            [0x2b1b, 0x2b1c, "⬛⬜ large squares"],
            [0x2b50, 0x2b50, "⭐ white medium star"],
            [0x2b55, 0x2b55, "⭕ heavy large circle"],
        ];

        for (const [start, end, label] of ranges) {
            it(`returns 2 across ${label} (U+${start.toString(16).toUpperCase()}..U+${end.toString(16).toUpperCase()})`, () => {
                expect(getCharDisplayWidth(start)).toBe(2);
                expect(getCharDisplayWidth(end)).toBe(2);
            });
        }

        it("returns 2 for MAN DANCING (U+1F57A)", () => {
            expect(getCharDisplayWidth(0x1f57a)).toBe(2);
        });

        // Regression for issue #60: colored circle emoji used as legend bullets
        // (🟠🟡🟢) were computed as width 1, desyncing column accounting on scroll.
        it("returns 2 for colored circles 🟠🟡🟢 (U+1F7E0..U+1F7E2)", () => {
            expect(getCharDisplayWidth(0x1f7e0)).toBe(2); // 🟠 orange
            expect(getCharDisplayWidth(0x1f7e1)).toBe(2); // 🟡 yellow
            expect(getCharDisplayWidth(0x1f7e2)).toBe(2); // 🟢 green
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

    it("returns 1 for a cluster that is entirely zero-width", () => {
        // A lone combining mark has no base: every code point is zero-width,
        // so the result falls back to 1 because the cluster is non-empty.
        expect(getGraphemeDisplayWidth("́")).toBe(1);
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
