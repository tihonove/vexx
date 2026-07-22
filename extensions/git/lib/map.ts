/** A resource decoration: a single-letter badge plus a theme color id. */
export interface IStatusDecoration {
    badge: string;
    colorId: string;
}

// Effective single-status letter → badge + `gitDecoration.*` color id.
const DECORATION_BY_STATUS: Record<string, IStatusDecoration> = {
    M: { badge: "M", colorId: "gitDecoration.modifiedResourceForeground" },
    A: { badge: "A", colorId: "gitDecoration.addedResourceForeground" },
    D: { badge: "D", colorId: "gitDecoration.deletedResourceForeground" },
    R: { badge: "R", colorId: "gitDecoration.renamedResourceForeground" },
    C: { badge: "C", colorId: "gitDecoration.renamedResourceForeground" },
    "?": { badge: "U", colorId: "gitDecoration.untrackedResourceForeground" },
    "!": { badge: "I", colorId: "gitDecoration.ignoredResourceForeground" },
    U: { badge: "U", colorId: "gitDecoration.conflictingResourceForeground" },
};

// Porcelain `XY` codes that denote an unmerged (conflicting) path.
const UNMERGED_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Map a porcelain `XY` status to a resource decoration. Untracked (`??`),
 * ignored (`!!`) and unmerged combinations are recognised first; otherwise the
 * index status wins over the working-tree status. Unknown codes fall back to
 * "modified".
 */
export function statusToDecoration(xy: string): IStatusDecoration {
    const code = primaryStatusChar(xy);
    return DECORATION_BY_STATUS[code] ?? DECORATION_BY_STATUS.M;
}

/** Reduce a two-character `XY` code to the single status letter that drives the badge. */
function primaryStatusChar(xy: string): string {
    if (xy === "??") return "?";
    if (xy === "!!") return "!";
    if (UNMERGED_CODES.has(xy)) return "U";
    const x = xy[0];
    return x !== " " ? x : xy[1];
}
