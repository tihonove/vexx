import type { IRange } from "../core/iRange.ts";

/**
 * Minimal view-level projection the editor needs to paint a change bar in the
 * gutter (à la VS Code's dirty-diff / SCM change decorations): the line range
 * the change covers and the packed-RGB colour of its bar.
 *
 * Decoupled from any source (git, SCM provider, extension) so the editor stays
 * provider-agnostic — whoever computes the changes resolves the colour first
 * and pushes only this. A deleted hunk is expressed as a single boundary line
 * (an empty range on the line below the deletion).
 */
export interface IGutterChangeDecoration {
    readonly range: IRange;
    /** Packed 24-bit RGB colour of the change bar (see `Rendering/ColorUtils.packRgb`). */
    readonly color: number;
    /**
     * Paint the bar dashed rather than solid. Source-agnostic: whoever computes
     * the changes decides (VS Code's dirty-diff draws modified lines dashed and
     * added/deleted solid). Defaults to solid when omitted.
     */
    readonly dashed?: boolean;
}
