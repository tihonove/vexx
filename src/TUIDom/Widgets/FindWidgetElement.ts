import { DisplayLine } from "../../Common/DisplayLine.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { InputElement } from "./InputElement.ts";

// ─── Colors ─────────────────────────────────────────────────────────────────
const BORDER_FG = packRgb(83, 83, 83);
const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const COUNTER_FG = packRgb(150, 150, 150);
const NO_RESULTS_FG = packRgb(220, 120, 120);
const BUTTON_FG = packRgb(180, 180, 180);

// Navigation / close buttons, drawn right-aligned in the input row.
const PREV_GLYPH = "↑";
const NEXT_GLYPH = "↓";
const CLOSE_GLYPH = "✕";
const NAV = `${PREV_GLYPH} ${NEXT_GLYPH} ${CLOSE_GLYPH}`; // 5 cells wide

/**
 * Find-in-file widget: a single-row bordered box with a query input, a
 * right-aligned match counter ("{i} of {n}" / "No results") and ↑ ↓ ✕ buttons.
 *
 * The widget does NOT own navigation keys — open/next/prev/close are driven by
 * registered commands. Clicking a button invokes the matching callback so the
 * mouse mirrors those commands.
 */
export class FindWidgetElement extends TUIElement {
    public placeholder = "Find";
    public preferredWidth = 44;

    public onQueryChange: ((query: string) => void) | null = null;
    public onNext: (() => void) | null = null;
    public onPrev: (() => void) | null = null;
    public onClose: (() => void) | null = null;

    public readonly inputElement: InputElement;

    private matchCurrent = 0;
    private matchTotal = 0;

    // Local X of each button in the input row, recomputed each render for hit-testing.
    private prevButtonX = -1;
    private nextButtonX = -1;
    private closeButtonX = -1;

    public constructor() {
        super();
        this.tabIndex = 0;

        this.inputElement = new InputElement();
        this.inputElement.showBorder = false;
        this.inputElement.setParent(this);
        this.inputElement.onChange = (value) => {
            this.onQueryChange?.(value);
        };

        this.addEventListener("mousedown", (event) => {
            this.handleMouseDown(event as TUIMouseEvent);
        });
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    public getQuery(): string {
        return this.inputElement.inputState.value;
    }

    public setQuery(value: string): void {
        this.inputElement.inputState.value = value;
        this.markDirty();
    }

    /** Updates the match counter. `current` is 1-based; `total` 0 means no matches. */
    public setCounter(current: number, total: number): void {
        this.matchCurrent = current;
        this.matchTotal = total;
        this.markDirty();
    }

    /** Delegate focus to the inner input. */
    public override focus(): void {
        this.inputElement.focus();
    }

    // ─── Layout ─────────────────────────────────────────────────────────────

    public override getMinIntrinsicWidth(_height: number): number {
        return 24;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.preferredWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 3;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 3;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const maxW = Number.isFinite(constraints.maxWidth) ? constraints.maxWidth : this.preferredWidth;
        const width = Math.max(constraints.minWidth, Math.min(this.preferredWidth, maxW));
        const size = new Size(width, 3);
        super.performLayout(BoxConstraints.tight(size));

        // Input occupies the row between the left border and the right-side block.
        const inputWidth = Math.max(0, size.width - 2 - this.rightBlockWidth() - 1);
        this.inputElement.localPosition = new Offset(1, 1);
        this.inputElement.globalPosition = new Point(this.globalPosition.x + 1, this.globalPosition.y + 1);
        this.inputElement.performLayout(BoxConstraints.tight(new Size(inputWidth, 1)));

        return size;
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.inputElement];
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    public override render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = 3;

        // Background fill.
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.setCell(x, y, { char: " ", fg: FG, bg: BG });
            }
        }

        // Borders: top / sides / bottom.
        context.setCell(0, 0, { char: "┌", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 0, { char: "┐", fg: BORDER_FG, bg: BG });
        context.setCell(0, 2, { char: "└", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 2, { char: "┘", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) {
            context.setCell(x, 0, { char: "─", fg: BORDER_FG, bg: BG });
            context.setCell(x, 2, { char: "─", fg: BORDER_FG, bg: BG });
        }
        context.setCell(0, 1, { char: "│", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 1, { char: "│", fg: BORDER_FG, bg: BG });

        // Input.
        this.inputElement.placeholder = this.placeholder;
        const inputClip = new Rect(this.inputElement.globalPosition, this.inputElement.layoutSize);
        const inputOffset = new Offset(this.inputElement.localPosition.dx, this.inputElement.localPosition.dy);
        this.inputElement.render(context.withOffset(inputOffset).withClip(inputClip));

        // Right-side block: counter + nav/close buttons, right-aligned in row 1.
        const counter = this.counterText();
        const counterW = counter === "" ? 0 : new DisplayLine(counter).displayWidth;
        const rightW = this.rightBlockWidth();
        const rx = w - 1 - rightW;

        if (counter !== "") {
            const counterFg = this.matchTotal === 0 ? NO_RESULTS_FG : COUNTER_FG;
            context.drawText(rx, 1, counter, { fg: counterFg, bg: BG });
        }

        const navStart = counter === "" ? rx : rx + counterW + 2;
        context.drawText(navStart, 1, NAV, { fg: BUTTON_FG, bg: BG });
        this.prevButtonX = navStart;
        this.nextButtonX = navStart + 2;
        this.closeButtonX = navStart + 4;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private counterText(): string {
        if (this.inputElement.inputState.value.length === 0) return "";
        if (this.matchTotal === 0) return "No results";
        return `${this.matchCurrent} of ${this.matchTotal}`;
    }

    /** Width reserved on the right of the input row (counter + 2-space gap + NAV). */
    private rightBlockWidth(): number {
        const counter = this.counterText();
        const navW = new DisplayLine(NAV).displayWidth;
        if (counter === "") return navW;
        return new DisplayLine(counter).displayWidth + 2 + navW;
    }

    private handleMouseDown(event: TUIMouseEvent): void {
        // Only act on clicks that land on the widget chrome (not the inner input).
        if (event.target !== this || event.button !== "left" || event.localY !== 1) return;

        if (event.localX === this.closeButtonX) {
            event.preventDefault();
            this.onClose?.();
        } else if (event.localX === this.nextButtonX) {
            event.preventDefault();
            this.onNext?.();
        } else if (event.localX === this.prevButtonX) {
            event.preventDefault();
            this.onPrev?.();
        }
    }
}
