import { DisplayLine } from "../../Common/DisplayLine.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { ButtonElement } from "./ButtonElement.ts";
import { InputElement } from "./InputElement.ts";

// ─── Colors ─────────────────────────────────────────────────────────────────
const BORDER_FG = packRgb(83, 83, 83);
const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const COUNTER_FG = packRgb(150, 150, 150);
const NO_RESULTS_FG = packRgb(220, 120, 120);

// Navigation / close button labels, rendered right-aligned in the input row.
const PREV_GLYPH = "↑";
const NEXT_GLYPH = "↓";
const CLOSE_GLYPH = "✕";

// Each ButtonElement renders "[ x ]" → label.length (1) + 4 = 5 cells; 1-cell gap between.
const BUTTON_W = 5;
const BUTTON_GAP = 1;
const NAV_W = 3 * BUTTON_W + 2 * BUTTON_GAP; // 17 cells

/**
 * Find-in-file widget: a single-row bordered box with a query input, a
 * right-aligned match counter ("{i} of {n}" / "No results") and ↑ ↓ ✕ buttons.
 *
 * The buttons are real {@link ButtonElement}s, so they get the theme-driven
 * hover highlight for free. They are non-focusable (tabIndex = -1) so clicking
 * them never steals focus from the query input. The widget does NOT own
 * navigation keys — open/next/prev/close are driven by registered commands;
 * clicking a button invokes the matching callback so the mouse mirrors those.
 */
export class FindWidgetElement extends TUIElement {
    public placeholder = "Find";
    public preferredWidth = 44;

    public onQueryChange: ((query: string) => void) | null = null;
    public onNext: (() => void) | null = null;
    public onPrev: (() => void) | null = null;
    public onClose: (() => void) | null = null;

    public readonly inputElement: InputElement;

    private readonly prevButton: ButtonElement;
    private readonly nextButton: ButtonElement;
    private readonly closeButton: ButtonElement;

    private matchCurrent = 0;
    private matchTotal = 0;

    public constructor() {
        super();
        this.tabIndex = 0;

        this.inputElement = new InputElement();
        this.inputElement.showBorder = false;
        this.inputElement.setParent(this);
        this.inputElement.onChange = (value) => {
            this.onQueryChange?.(value);
        };

        this.prevButton = this.createButton(PREV_GLYPH, () => this.onPrev?.());
        this.nextButton = this.createButton(NEXT_GLYPH, () => this.onNext?.());
        this.closeButton = this.createButton(CLOSE_GLYPH, () => this.onClose?.());
    }

    private createButton(label: string, onActivate: () => void): ButtonElement {
        const button = new ButtonElement(label);
        button.tabIndex = -1; // keep focus in the query input on click
        button.onActivate = onActivate;
        button.setParent(this);
        return button;
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

    /**
     * Push button colors from the active theme. The buttons are never focused, so the
     * "secondary" tokens drive their look; fallbacks keep the historical appearance
     * when a theme omits the `button.*` tokens. Mirrors {@link ConfirmSaveDialogElement}.
     */
    public applyTheme(theme: WorkbenchTheme): void {
        for (const button of this.buttons()) {
            button.focusedBg = theme.getColorOrDefault("button.background", packRgb(0, 120, 215));
            button.focusedFg = theme.getColorOrDefault("button.foreground", packRgb(255, 255, 255));
            button.focusedHoverBg = theme.getColorOrDefault("button.hoverBackground", packRgb(26, 134, 224));
            button.normalBg = theme.getColorOrDefault("button.secondaryBackground", packRgb(60, 60, 60));
            button.normalFg = theme.getColorOrDefault("button.secondaryForeground", packRgb(204, 204, 204));
            button.normalHoverBg = theme.getColorOrDefault("button.secondaryHoverBackground", packRgb(69, 73, 78));
            button.markDirty();
        }
    }

    /** Delegate focus to the inner input. */
    public override focus(): void {
        this.inputElement.focus();
    }

    // ─── Layout ─────────────────────────────────────────────────────────────

    public override getMinIntrinsicWidth(_height: number): number {
        return 30;
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

        this.layoutButtons();

        return size;
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.inputElement, this.prevButton, this.nextButton, this.closeButton];
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

        // Right-side block: counter (left of the buttons), right-aligned in row 1.
        const counter = this.counterText();
        if (counter !== "") {
            const rightW = this.rightBlockWidth();
            const rx = w - 1 - rightW;
            const counterFg = this.matchTotal === 0 ? NO_RESULTS_FG : COUNTER_FG;
            context.drawText(rx, 1, counter, { fg: counterFg, bg: BG });
        }

        // Nav / close buttons. Positions depend on the counter width, which can change
        // via setCounter() without a relayout, so refresh them here before rendering.
        this.layoutButtons();
        for (const button of this.buttons()) {
            const clip = new Rect(button.globalPosition, button.layoutSize);
            const offset = new Offset(button.localPosition.dx, button.localPosition.dy);
            button.render(context.withOffset(offset).withClip(clip));
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private buttons(): readonly ButtonElement[] {
        return [this.prevButton, this.nextButton, this.closeButton];
    }

    /** Lays out the three nav buttons right-aligned in the input row, after the counter. */
    private layoutButtons(): void {
        const w = this.layoutSize.width;
        const counter = this.counterText();
        const counterW = counter === "" ? 0 : new DisplayLine(counter).displayWidth;
        const rightW = this.rightBlockWidth();
        const rx = w - 1 - rightW;
        const navStart = counter === "" ? rx : rx + counterW + 2;

        let x = navStart;
        for (const button of this.buttons()) {
            button.performLayout(BoxConstraints.tight(new Size(BUTTON_W, 1)));
            button.localPosition = new Offset(x, 1);
            button.globalPosition = new Point(this.globalPosition.x + x, this.globalPosition.y + 1);
            x += BUTTON_W + BUTTON_GAP;
        }
    }

    private counterText(): string {
        if (this.inputElement.inputState.value.length === 0) return "";
        if (this.matchTotal === 0) return "No results";
        return `${this.matchCurrent} of ${this.matchTotal}`;
    }

    /** Width reserved on the right of the input row (counter + 2-space gap + buttons). */
    private rightBlockWidth(): number {
        const counter = this.counterText();
        if (counter === "") return NAV_W;
        return new DisplayLine(counter).displayWidth + 2 + NAV_W;
    }
}
