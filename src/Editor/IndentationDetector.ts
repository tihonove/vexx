import type { ITextDocument } from "./ITextDocument.ts";

export interface DetectedIndentation {
    readonly insertSpaces: boolean;
    readonly tabSize: number;
}

const MAX_SCAN_LINES = 1000;

/**
 * Detects indentation style from document content by scanning leading whitespace.
 * Returns null if the document has no indented lines (no signal).
 */
export function detectIndentation(document: ITextDocument): DetectedIndentation | null {
    let tabLines = 0;
    const spaceCounts = new Map<number, number>();

    const lineCount = Math.min(document.lineCount, MAX_SCAN_LINES);
    for (let i = 0; i < lineCount; i++) {
        const line = document.getLineContent(i);
        if (line.length === 0) continue;

        if (line[0] === "\t") {
            tabLines++;
        } else if (line[0] === " ") {
            let spaces = 0;
            while (spaces < line.length && line[spaces] === " ") {
                spaces++;
            }
            if (spaces > 0 && spaces < line.length) {
                spaceCounts.set(spaces, (spaceCounts.get(spaces) ?? 0) + 1);
            }
        }
    }

    const totalSpaceLines = [...spaceCounts.values()].reduce((a, b) => a + b, 0);

    if (tabLines === 0 && totalSpaceLines === 0) {
        return null;
    }

    if (tabLines >= totalSpaceLines) {
        return { insertSpaces: false, tabSize: 4 };
    }

    const tabSize = detectTabSize(spaceCounts);
    return { insertSpaces: true, tabSize };
}

function detectTabSize(spaceCounts: Map<number, number>): number {
    // The tab size is the GCD of all observed indentation levels.
    const sizes = [...spaceCounts.keys()];
    if (sizes.length === 0) return 4;
    let result = sizes[0];
    for (let i = 1; i < sizes.length; i++) {
        result = gcd(result, sizes[i]);
    }
    // Clamp to a reasonable range.
    return Math.max(1, Math.min(result, 8));
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
}
