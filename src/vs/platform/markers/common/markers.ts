import type { IRange } from "../../../editor/common/core/range.ts";

/**
 * Severity of a diagnostic marker. Values mirror VS Code's `MarkerSeverity`
 * (`vs/platform/markers`) so ordering (`Error > Warning > Info > Hint`) can be
 * compared numerically and higher severity wins.
 */
export enum MarkerSeverity {
    Hint = 1,
    Info = 2,
    Warning = 4,
    Error = 8,
}

/**
 * A single diagnostic as produced by a provider (validator, LSP, problem
 * matcher, extension). Provider-agnostic — the marker service does not care
 * where it came from.
 *
 * Mirrors VS Code's `IMarkerData`: the `owner`/`resource` are supplied to
 * `changeOne`, not carried on the datum itself.
 */
export interface IMarkerData {
    readonly severity: MarkerSeverity;
    readonly range: IRange;
    readonly message: string;
    /** Optional machine-readable code (e.g. rule id). */
    readonly code?: string;
    /** Optional human-readable source label (e.g. "json", "eslint"). */
    readonly source?: string;
}

/**
 * A marker as stored/read from the {@link IMarkerService}: an {@link IMarkerData}
 * tagged with the `owner` (provider namespace) and `resource` (file path/URI)
 * it belongs to.
 */
export interface IMarker extends IMarkerData {
    readonly owner: string;
    readonly resource: string;
}

/**
 * Minimal view-level projection of a marker the editor needs to render a
 * squiggle: just the range and the severity (which picks the colour). Decoupled
 * from `owner`/`resource`/`message` so the editor stays provider-agnostic.
 */
export interface IMarkerDecoration {
    readonly range: IRange;
    readonly severity: MarkerSeverity;
}
