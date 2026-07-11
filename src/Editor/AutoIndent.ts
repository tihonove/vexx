/**
 * Language-agnostic auto-indentation for line breaks (Enter).
 *
 * Given the current line and cursor column, computes what to insert so that the
 * new line keeps the current line's indentation. Two extra heuristics on top of
 * plain carry-over:
 *  - the line before the cursor ends with an opening bracket → indent one level deeper;
 *  - the opening bracket is immediately followed by its matching closer (`{}` `[]` `()`)
 *    → expand the block: the closer moves to its own line at the original indent and
 *    the cursor lands on an empty, one-level-deeper middle line.
 *
 * No `language-configuration.json` / `indentationRules` are consulted (Phase 1).
 */

const OPEN_TO_CLOSE = new Map<string, string>([
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
]);

export interface NewLinePlanParams {
    /** Full text of the line the cursor is on. */
    readonly lineContent: string;
    /** Cursor column within that line. */
    readonly column: number;
    readonly tabSize: number;
    readonly insertSpaces: boolean;
}

export interface NewLinePlan {
    /** Text to insert at the cursor. Always starts with `"\n"`. */
    readonly editText: string;
    /**
     * When true the inserted text spans two new lines (block expansion) and the
     * cursor must be placed on the middle line rather than at the end of the text.
     */
    readonly blockExpand: boolean;
    /** Target column for the cursor on its resulting line. */
    readonly cursorColumn: number;
}

/** Returns the leading run of spaces/tabs of a line. */
export function getLeadingWhitespace(line: string): string {
    let i = 0;
    while (i < line.length && (line[i] === " " || line[i] === "\t")) {
        i++;
    }
    return line.slice(0, i);
}

/** Computes what to insert (and where the cursor ends up) for a newline at `column`. */
export function computeNewLinePlan(params: NewLinePlanParams): NewLinePlan {
    const { lineContent, column, tabSize, insertSpaces } = params;

    const leading = getLeadingWhitespace(lineContent);
    // Never carry more indentation than the cursor sits at (cursor inside the indent).
    const base = leading.slice(0, Math.min(leading.length, column));
    const unit = insertSpaces ? " ".repeat(tabSize) : "\t";

    const before = lineContent.slice(0, column).replace(/\s+$/, "");
    const after = lineContent.slice(column);

    const openChar = before.length > 0 ? before[before.length - 1] : "";
    const closeChar = OPEN_TO_CLOSE.get(openChar);

    if (closeChar !== undefined) {
        const inner = base + unit;
        if (after.startsWith(closeChar)) {
            // `{|}` → expand the block; closer drops to its own line at the base indent.
            return { editText: "\n" + inner + "\n" + base, blockExpand: true, cursorColumn: inner.length };
        }
        return { editText: "\n" + inner, blockExpand: false, cursorColumn: inner.length };
    }

    return { editText: "\n" + base, blockExpand: false, cursorColumn: base.length };
}
