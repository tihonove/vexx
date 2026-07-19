import type { IFoldingRegion } from "./iFoldingRegion.ts";
import { createFoldingRegion } from "./iFoldingRegion.ts";
import type { ITextDocument } from "../../common/model/iTextDocument.ts";

/**
 * Computes the visual indentation width of a line (spaces + tab expansion),
 * or -1 when the line is empty / whitespace-only. Mirrors VS Code's
 * `computeIndentLevel`.
 */
export function computeIndentLevel(line: string, tabSize: number): number {
    let indent = 0;
    let i = 0;
    const len = line.length;
    while (i < len) {
        const ch = line[i];
        if (ch === " ") {
            indent++;
        } else if (ch === "\t") {
            indent = indent - (indent % tabSize) + tabSize;
        } else {
            break;
        }
        i++;
    }
    if (i === len) return -1; // whitespace only
    return indent;
}

/**
 * Derives folding regions from a document purely by indentation — the same
 * strategy VS Code applies as the default (and as a fallback until a
 * language-aware provider contributes ranges).
 *
 * A region opens on a line whose following (deeper-indented) lines are nested
 * underneath it and closes just before indentation drops back to the header's
 * level. Blank lines are attached to the region above them. Only regions that
 * hide at least one line are returned. Result is sorted by `startLine` ascending.
 *
 * `offSide` (blank lines terminate a block, e.g. Python) is not yet honoured —
 * see docs/TODO for the language-configuration follow-up.
 */
export function computeIndentationFolds(document: ITextDocument, tabSize: number): IFoldingRegion[] {
    const lineCount = document.lineCount;
    const result: IFoldingRegion[] = [];

    // Stack of open regions, scanned bottom-to-top. `endAbove` is the line index
    // one past the region's last content line (0-based). The sentinel spans the
    // whole document at indent -1 so the outermost region always closes.
    const openRegions: { indent: number; endAbove: number }[] = [{ indent: -1, endAbove: lineCount }];

    for (let line = lineCount - 1; line >= 0; line--) {
        const indent = computeIndentLevel(document.getLineContent(line), tabSize);
        if (indent === -1) {
            // Blank line: attach to the region above (offSide=false).
            continue;
        }

        let previous = openRegions[openRegions.length - 1];
        if (previous.indent > indent) {
            // Every deeper region ends at this line; the shallowest one that
            // reaches back to `indent` starts a foldable region here.
            do {
                openRegions.pop();
                previous = openRegions[openRegions.length - 1];
            } while (previous.indent > indent);

            const endLine = previous.endAbove - 1;
            /* v8 ignore start -- defensive: a region always spans its header plus at least one deeper line, so endLine is always > line; the guard never rejects */
            if (endLine - line >= 1) {
                result.push(createFoldingRegion(line, endLine));
            }
            /* v8 ignore stop */
        }

        if (previous.indent === indent) {
            previous.endAbove = line;
        } else {
            openRegions.push({ indent, endAbove: line });
        }
    }

    result.sort((a, b) => a.startLine - b.startLine);
    return result;
}
