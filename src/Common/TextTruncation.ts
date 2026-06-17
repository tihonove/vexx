import { DisplayLine } from "./DisplayLine.ts";

/**
 * Display-width-aware text truncation helpers.
 *
 * All widths are measured in terminal columns via {@link DisplayLine}, so wide
 * (CJK / emoji) characters and combining marks are handled correctly. The
 * ellipsis is whatever string you pass (default "…", width 1).
 */

const DEFAULT_ELLIPSIS = "…";

function width(text: string): number {
    return new DisplayLine(text).displayWidth;
}

/** Take the longest leading run of graphemes that fits in `maxWidth` columns. */
function takePrefix(dl: DisplayLine, maxWidth: number): { text: string; width: number } {
    let w = 0;
    let out = "";
    for (const slot of dl.slots) {
        if (w + slot.displayWidth > maxWidth) break;
        out += slot.grapheme;
        w += slot.displayWidth;
    }
    return { text: out, width: w };
}

/** Take the longest trailing run of graphemes that fits in `maxWidth` columns. */
function takeSuffix(dl: DisplayLine, maxWidth: number): { text: string; width: number } {
    let w = 0;
    let out = "";
    for (let i = dl.slots.length - 1; i >= 0; i--) {
        const slot = dl.slots[i];
        if (w + slot.displayWidth > maxWidth) break;
        out = slot.grapheme + out;
        w += slot.displayWidth;
    }
    return { text: out, width: w };
}

/**
 * Truncate `text` to `maxWidth` columns, putting the ellipsis at the END:
 *   "VeryLongFileName.ts" → "VeryLongFile…"
 *
 * The kept prefix is preserved grapheme-for-grapheme (so byte offsets of the
 * prefix are unchanged — important for match highlighting). Returns `text`
 * unchanged when it already fits, and "" when even the ellipsis doesn't fit.
 */
export function truncateEnd(text: string, maxWidth: number, ellipsis: string = DEFAULT_ELLIPSIS): string {
    if (maxWidth <= 0) return "";
    const dl = new DisplayLine(text);
    if (dl.displayWidth <= maxWidth) return text;
    const ew = width(ellipsis);
    if (maxWidth < ew) return "";
    return takePrefix(dl, maxWidth - ew).text + ellipsis;
}

/**
 * Truncate `text` to `maxWidth` columns, putting the ellipsis in the MIDDLE:
 *   "VeryLongFileName" → "VeryL…Name"
 *
 * Returns `text` unchanged when it fits, the ellipsis alone when only one
 * column (its width) is available, and "" when even that doesn't fit.
 */
export function truncateMiddle(text: string, maxWidth: number, ellipsis: string = DEFAULT_ELLIPSIS): string {
    if (maxWidth <= 0) return "";
    const dl = new DisplayLine(text);
    if (dl.displayWidth <= maxWidth) return text;
    const ew = width(ellipsis);
    if (maxWidth < ew) return "";
    if (maxWidth === ew) return ellipsis;

    const budget = maxWidth - ew;
    const headBudget = Math.ceil(budget / 2);
    const tailBudget = budget - headBudget;
    const head = takePrefix(dl, headBudget);
    const tail = takeSuffix(dl, tailBudget);
    return head.text + ellipsis + tail.text;
}

/**
 * Abbreviate a `/`-separated path to fit in `maxWidth` columns, keeping the
 * most useful segments visible. Priority of what stays visible:
 *   1. the first segment,
 *   2. the last segment,
 *   3. then segments from the 2nd onward, filling the remaining space.
 * The ellipsis sits between them, so it usually lands in the middle:
 *   "src/components/widgets/popups/menu" → "src/components/…/menu"
 *
 * Returns the path unchanged when it fits. Degrades gracefully on very narrow
 * widths: "…/last", then a middle-truncated last segment.
 */
export function abbreviatePath(path: string, maxWidth: number, ellipsis: string = DEFAULT_ELLIPSIS): string {
    if (maxWidth <= 0) return "";
    if (width(path) <= maxWidth) return path;

    const segments = path.split("/").filter((s) => s.length > 0);
    // One segment (or a degenerate path) has no directory structure to exploit.
    // Two segments can't show "first/…/last" shorter than "first/last" itself,
    // so fall back to middle-truncating the whole string.
    if (segments.length <= 2) return truncateMiddle(path, maxWidth, ellipsis);

    const first = segments[0];
    const last = segments[segments.length - 1];

    const base = `${first}/${ellipsis}/${last}`;
    if (width(base) > maxWidth) {
        const tailOnly = `${ellipsis}/${last}`;
        if (width(tailOnly) <= maxWidth) return tailOnly;
        return truncateMiddle(last, maxWidth, ellipsis);
    }

    // Greedily grow the visible prefix from the 2nd segment onward, never
    // including the last segment (it is always shown separately).
    let best = 1;
    for (let p = 2; p <= segments.length - 2; p++) {
        const candidate = `${segments.slice(0, p).join("/")}/${ellipsis}/${last}`;
        if (width(candidate) > maxWidth) break;
        best = p;
    }
    return `${segments.slice(0, best).join("/")}/${ellipsis}/${last}`;
}
