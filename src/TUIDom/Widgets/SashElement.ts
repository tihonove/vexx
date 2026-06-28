import type { RenderContext } from "../TUIElement.ts";
import { TUIElement } from "../TUIElement.ts";

/**
 * Invisible draggable divider (a "sash") used to resize a neighbouring panel.
 *
 * It opts into pointer capture so that once the user presses the left button on it,
 * every subsequent move/release is delivered here even while the cursor is over the
 * editor next to it. While dragging it reports the absolute boundary column (screenX)
 * to its owner via {@link onDrag}; the owner clamps and applies the new width.
 *
 * It renders nothing — the boundary stays visually owned by the panels around it.
 */
export class SashElement extends TUIElement {
    public onDrag?: (boundaryScreenX: number) => void;

    private dragging = false;

    public constructor() {
        super();
        this.capturesPointer = true;
        // Keep tabIndex = -1 so mousedown does not steal focus from the file tree.

        this.addEventListener("mousedown", (event) => {
            if (event.button !== "left") return;
            this.dragging = true;
        });
        this.addEventListener("mousemove", (event) => {
            if (!this.dragging) return;
            this.onDrag?.(event.screenX);
        });
        this.addEventListener("mouseup", () => {
            this.dragging = false;
        });
    }

    public override render(_context: RenderContext): void {
        // Intentionally empty — the sash is an invisible hit/drag target.
    }
}
