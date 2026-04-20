/**
 * Determines the display width of a Unicode code point in a terminal.
 *
 * Returns:
 *  - 0 for control characters, combining marks, zero-width chars
 *  - 2 for East Asian Wide / Fullwidth characters and emoji
 *  - 1 for everything else
 *
 * Does NOT handle tabs — tab width depends on column position and is
 * computed by DisplayLine.
 */
export function getCharDisplayWidth(codePoint: number): number {
    // Control characters (C0, DEL, C1)
    if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) {
        return 0;
    }

    // Zero-width characters
    if (isZeroWidth(codePoint)) {
        return 0;
    }

    // Wide / Fullwidth characters
    if (isWide(codePoint)) {
        return 2;
    }

    return 1;
}

function isZeroWidth(cp: number): boolean {
    // Combining Diacritical Marks
    if (cp >= 0x0300 && cp <= 0x036f) return true;
    // Combining Diacritical Marks Extended
    if (cp >= 0x1ab0 && cp <= 0x1aff) return true;
    // Combining Diacritical Marks Supplement
    if (cp >= 0x1dc0 && cp <= 0x1dff) return true;
    // Combining Diacritical Marks for Symbols
    if (cp >= 0x20d0 && cp <= 0x20ff) return true;
    // Combining Half Marks
    if (cp >= 0xfe20 && cp <= 0xfe2f) return true;

    // Thai combining marks
    if (cp >= 0x0e31 && cp <= 0x0e3a) return true;
    if (cp >= 0x0e47 && cp <= 0x0e4e) return true;

    // General combining marks (Mn, Mc, Me categories — major blocks)
    // Hebrew points
    if (cp >= 0x0591 && cp <= 0x05bd) return true;
    if (cp === 0x05bf) return true;
    if (cp >= 0x05c1 && cp <= 0x05c2) return true;
    if (cp >= 0x05c4 && cp <= 0x05c5) return true;
    if (cp === 0x05c7) return true;
    // Arabic combining
    if (cp >= 0x0610 && cp <= 0x061a) return true;
    if (cp >= 0x064b && cp <= 0x065f) return true;
    if (cp === 0x0670) return true;
    if (cp >= 0x06d6 && cp <= 0x06dc) return true;
    if (cp >= 0x06df && cp <= 0x06e4) return true;
    if (cp >= 0x06e7 && cp <= 0x06e8) return true;
    if (cp >= 0x06ea && cp <= 0x06ed) return true;
    // Devanagari combining
    if (cp >= 0x0900 && cp <= 0x0903) return true;
    if (cp >= 0x093a && cp <= 0x094f) return true;
    if (cp >= 0x0951 && cp <= 0x0957) return true;

    // Hangul Jamo combining (medial/final)
    if (cp >= 0x1160 && cp <= 0x11ff) return true;

    // Variation Selectors
    if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
    // Variation Selectors Supplement
    if (cp >= 0xe0100 && cp <= 0xe01ef) return true;

    // Zero Width Space, ZWNJ, ZWJ, Soft Hyphen
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0x00ad) return true;
    // Word Joiner, BOM
    if (cp === 0x2060 || cp === 0xfeff) return true;

    // CGJ (Combining Grapheme Joiner)
    if (cp === 0x034f) return true;

    return false;
}

function isWide(cp: number): boolean {
    // CJK Radicals Supplement .. Kangxi Radicals
    if (cp >= 0x2e80 && cp <= 0x2fdf) return true;
    // Ideographic Description Characters .. CJK Symbols and Punctuation
    if (cp >= 0x2ff0 && cp <= 0x303e) return true;
    // Hiragana, Katakana, Bopomofo, Hangul Compatibility Jamo, Kanbun, etc.
    if (cp >= 0x3040 && cp <= 0x33bf) return true;
    // CJK Compatibility (3300–33FF already covered), CJK Unified Ideographs Extension A
    if (cp >= 0x33c0 && cp <= 0x4dbf) return true;
    // CJK Unified Ideographs
    if (cp >= 0x4e00 && cp <= 0x9fff) return true;
    // Yi Syllables, Yi Radicals
    if (cp >= 0xa000 && cp <= 0xa4cf) return true;
    // Hangul Syllables
    if (cp >= 0xac00 && cp <= 0xd7a3) return true;
    // CJK Compatibility Ideographs
    if (cp >= 0xf900 && cp <= 0xfaff) return true;
    // Vertical Forms
    if (cp >= 0xfe10 && cp <= 0xfe19) return true;
    // CJK Compatibility Forms
    if (cp >= 0xfe30 && cp <= 0xfe6f) return true;
    // Fullwidth forms (excluding halfwidth katakana)
    if (cp >= 0xff01 && cp <= 0xff60) return true;
    if (cp >= 0xffe0 && cp <= 0xffe6) return true;

    // CJK Unified Ideographs Extension B .. Extension H (SIP/TIP)
    if (cp >= 0x20000 && cp <= 0x3134f) return true;

    // Emoji — only code points with Emoji_Presentation = Yes.
    // Source: Unicode 15 emoji-data.txt
    //
    // Miscellaneous Symbols and Pictographs (1F300-1F5FF)
    // Emoji_Presentation=Yes sub-ranges only (text-presentation chars excluded):
    if (cp >= 0x1f300 && cp <= 0x1f320) return true; // weather, misc
    if (cp >= 0x1f32d && cp <= 0x1f335) return true; // food
    if (cp >= 0x1f337 && cp <= 0x1f37c) return true; // food, plants
    if (cp >= 0x1f37e && cp <= 0x1f393) return true; // activities
    if (cp >= 0x1f3a0 && cp <= 0x1f3ca) return true; // entertainment
    if (cp >= 0x1f3cf && cp <= 0x1f3d3) return true; // sports
    if (cp >= 0x1f3e0 && cp <= 0x1f3f0) return true; // buildings
    if (cp === 0x1f3f4) return true; // BLACK FLAG
    if (cp >= 0x1f3f8 && cp <= 0x1f43e) return true; // animals, nature
    if (cp === 0x1f440) return true; // EYES
    if (cp >= 0x1f442 && cp <= 0x1f4fc) return true; // objects
    if (cp >= 0x1f4ff && cp <= 0x1f53d) return true; // more objects
    if (cp >= 0x1f54b && cp <= 0x1f54e) return true; // religious
    if (cp >= 0x1f550 && cp <= 0x1f567) return true; // clocks
    if (cp === 0x1f57a) return true; // MAN DANCING
    if (cp >= 0x1f595 && cp <= 0x1f596) return true; // hand gestures
    if (cp === 0x1f5a4) return true; // BLACK HEART
    // Emoticons (1F600-1F64F) — all Emoji_Presentation=Yes
    if (cp >= 0x1f600 && cp <= 0x1f64f) return true;
    // Transport and Map Symbols (1F680-1F6FF) — Emoji_Presentation=Yes sub-ranges
    if (cp >= 0x1f680 && cp <= 0x1f6ca) return true;
    if (cp >= 0x1f6d0 && cp <= 0x1f6d2) return true;
    if (cp >= 0x1f6d5 && cp <= 0x1f6d7) return true;
    if (cp >= 0x1f6dd && cp <= 0x1f6df) return true;
    if (cp >= 0x1f6eb && cp <= 0x1f6ec) return true;
    if (cp >= 0x1f6f4 && cp <= 0x1f6fc) return true; // food
    if (cp >= 0x1f337 && cp <= 0x1f37c) return true; // food, plants
    if (cp >= 0x1f37e && cp <= 0x1f393) return true; // activities
    if (cp >= 0x1f3a0 && cp <= 0x1f3ca) return true; // entertainment
    if (cp >= 0x1f3cf && cp <= 0x1f3d3) return true; // sports
    if (cp >= 0x1f3e0 && cp <= 0x1f3f0) return true; // buildings
    if (cp === 0x1f3f4) return true; // BLACK FLAG
    if (cp >= 0x1f3f8 && cp <= 0x1f43e) return true; // animals, nature
    if (cp === 0x1f440) return true; // EYES
    if (cp >= 0x1f442 && cp <= 0x1f4fc) return true; // objects
    if (cp >= 0x1f4ff && cp <= 0x1f53d) return true; // more objects
    if (cp >= 0x1f54b && cp <= 0x1f54e) return true; // religious
    if (cp >= 0x1f550 && cp <= 0x1f567) return true; // clocks
    if (cp === 0x1f57a) return true; // MAN DANCING
    if (cp >= 0x1f595 && cp <= 0x1f596) return true; // hand gestures
    if (cp === 0x1f5a4) return true; // BLACK HEART
    if (cp >= 0x1f5fb && cp <= 0x1f5ff) return true; // MOUNT FUJI..MOYAI
    // Emoticons (1F600-1F64F) — all Emoji_Presentation=Yes
    if (cp >= 0x1f600 && cp <= 0x1f64f) return true;
    // Transport and Map Symbols (1F680-1F6FF) — Emoji_Presentation=Yes sub-ranges
    if (cp >= 0x1f680 && cp <= 0x1f6ca) return true;
    if (cp >= 0x1f6d0 && cp <= 0x1f6d2) return true;
    if (cp >= 0x1f6d5 && cp <= 0x1f6d7) return true;
    if (cp >= 0x1f6dd && cp <= 0x1f6df) return true;
    if (cp >= 0x1f6eb && cp <= 0x1f6ec) return true;
    if (cp >= 0x1f6f4 && cp <= 0x1f6fc) return true;
    // Supplemental Symbols and Pictographs
    if (cp >= 0x1f900 && cp <= 0x1f9ff) return true;
    // Symbols and Pictographs Extended-A
    if (cp >= 0x1fa00 && cp <= 0x1fa6f) return true;
    // Symbols and Pictographs Extended-B  (added Unicode 14+)
    if (cp >= 0x1fa70 && cp <= 0x1faff) return true;
    // Dingbats (many are emoji)
    if (cp >= 0x2700 && cp <= 0x27bf) return true;
    // Enclosed Alphanumeric Supplement (circled numbers, emoji)
    if (cp >= 0x1f100 && cp <= 0x1f1ff) return true;

    return false;
}

/**
 * Compute the display width of a grapheme cluster.
 * A cluster may contain multiple code points (e.g. emoji + ZWJ sequences).
 * The width is determined by the widest non-zero-width code point.
 */
export function getGraphemeDisplayWidth(grapheme: string): number {
    // VS16 (U+FE0F, Variation Selector-16) forces emoji presentation.
    // Any cluster containing VS16 is rendered as wide (2 columns) by terminals.
    if (grapheme.includes("\uFE0F")) {
        return 2;
    }

    let width = 0;
    for (const ch of grapheme) {
        const cp = ch.codePointAt(0) ?? 0;
        const w = getCharDisplayWidth(cp);
        if (w > width) width = w;
    }
    // A grapheme cluster always occupies at least 1 column unless it's empty
    // or entirely zero-width (which shouldn't happen for properly segmented graphemes).
    return width || (grapheme.length > 0 ? 1 : 0);
}
