/** How a hunk changed the working file, relative to `HEAD`. */
export type DiffHunkKind = "added" | "modified" | "deleted";

/** A contiguous change, expressed in *new-file* 1-based line numbers. */
export interface IDiffHunk {
    /** First affected line in the new file. */
    start: number;
    /** Number of affected lines (always `1` for a `deleted` boundary). */
    count: number;
    kind: DiffHunkKind;
}

// `@@ -oldStart[,oldCount] +newStart[,newCount] @@` — counts default to 1 when omitted.
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse the hunk headers of `git diff --no-color -U0 HEAD -- <path>`.
 *
 * With `-U0` there is no context, so each `@@` header maps directly to one change:
 * - `oldCount === 0` → pure insertion → `added` over the new lines;
 * - `newCount === 0` → pure deletion → `deleted`, collapsed to a single boundary line;
 * - otherwise → `modified` over the new lines.
 */
export function parseUnifiedDiffHunks(text: string): IDiffHunk[] {
    const hunks: IDiffHunk[] = [];

    for (const line of text.split("\n")) {
        const match = HUNK_HEADER.exec(line);
        if (!match) continue;

        const oldCountRaw = match.at(2);
        const oldCount = oldCountRaw !== undefined ? Number(oldCountRaw) : 1;
        const newStart = Number(match[3]);
        const newCountRaw = match.at(4);
        const newCount = newCountRaw !== undefined ? Number(newCountRaw) : 1;

        if (oldCount === 0) {
            hunks.push({ start: newStart, count: newCount, kind: "added" });
        } else if (newCount === 0) {
            hunks.push({ start: newStart, count: 1, kind: "deleted" });
        } else {
            hunks.push({ start: newStart, count: newCount, kind: "modified" });
        }
    }

    return hunks;
}
