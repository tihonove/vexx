/** One entry of `git status --porcelain=v1`. */
export interface IPorcelainEntry {
    /** Path relative to the repository root (the *new* path for renames/copies). */
    path: string;
    /** The two-character `XY` status code (`X` = index, `Y` = working tree). */
    xy: string;
}

/**
 * Parse the output of `git status --porcelain=v1 -z --untracked-files=all`.
 *
 * The `-z` form is NUL-terminated (no quoting, raw bytes) with records shaped
 * `XY<space>PATH`. Rename/copy records (`R`/`C` in `XY`) carry a *second*
 * NUL-terminated field — the original path — right after the record; we consume
 * it so it is not mistaken for a standalone entry, and report the new path.
 */
export function parsePorcelainStatus(buf: Buffer): IPorcelainEntry[] {
    const fields = splitNul(buf);
    const entries: IPorcelainEntry[] = [];

    let i = 0;
    while (i < fields.length) {
        const record = fields[i];
        const xy = record.slice(0, 2);
        // record is `XY<space>PATH`; the path starts after the single separating space.
        entries.push({ path: record.slice(3), xy });
        // Rename/copy records are followed by the original path in the next field.
        i += hasOriginalPath(xy) ? 2 : 1;
    }

    return entries;
}

/** Split a NUL-terminated buffer into UTF-8 fields (no trailing empty field). */
function splitNul(buf: Buffer): string[] {
    const fields: string[] = [];
    let start = 0;
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0) {
            fields.push(buf.toString("utf8", start, i));
            start = i + 1;
        }
    }
    if (start < buf.length) fields.push(buf.toString("utf8", start));
    return fields;
}

function hasOriginalPath(xy: string): boolean {
    return xy.includes("R") || xy.includes("C");
}
