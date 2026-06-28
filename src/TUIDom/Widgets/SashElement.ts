import type { RenderContext } from "../TUIElement.ts";
import { TUIElement } from "../TUIElement.ts";

/** How long the cursor must linger on the sash before the hover line lights up. */
const HOVER_DELAY_MS = 300;

/**
 * Draggable divider (a "sash") used to resize a neighbouring panel.
 *
 * It opts into pointer capture so that once the user presses the left button on it,
 * every subsequent move/release is delivered here even while the cursor is over the
 * editor next to it. While dragging it reports the absolute boundary column (screenX)
 * to its owner via {@link onDrag}; the owner clamps and applies the new width.
 *
 * It is invisible at rest. On hover — after a short delay so a passing cursor does not
 * flash it — it paints a thin vertical line so the user can tell the boundary is
 * draggable. The line also stays lit for the duration of a drag.
 */
export class SashElement extends TUIElement {
    public onDrag?: (boundaryScreenX: number) => void;

    /** Color of the hover line; when undefined the sash stays invisible. */
    public hoverBorderColor: number | undefined = undefined;

    private dragging = false;
    private hovered = false;
    private hoverTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor() {
        super();
        this.capturesPointer = true;
        // Keep tabIndex = -1 so mousedown does not steal focus from the file tree.

        this.addEventListener("mousedown", (event) => {
            if (event.button !== "left") return;
            // Dragging lights the line immediately; no point waiting on the hover delay.
            this.clearHoverTimer();
            this.dragging = true;
        });
        this.addEventListener("mousemove", (event) => {
            if (!this.dragging) return;
            this.onDrag?.(event.screenX);
        });
        this.addEventListener("mouseup", () => {
            this.dragging = false;
        });
        this.addEventListener("mouseenter", () => {
            this.clearHoverTimer();
            this.hoverTimer = setTimeout(() => {
                this.hoverTimer = null;
                this.hovered = true;
                this.markDirty();
            }, HOVER_DELAY_MS);
        });
        this.addEventListener("mouseleave", () => {
            this.clearHoverTimer();
            if (this.hovered) {
                this.hovered = false;
                this.markDirty();
            }
        });
    }

    private clearHoverTimer(): void {
        if (this.hoverTimer !== null) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = null;
        }
    }

    public override render(context: RenderContext): void {
        const color = this.hoverBorderColor;
        if (color === undefined || !(this.hovered || this.dragging)) return;
        const height = this.layoutSize.height;
        for (let y = 0; y < height; y++) {
            context.setCell(0, y, { char: "│", fg: color });
        }
    }
}
