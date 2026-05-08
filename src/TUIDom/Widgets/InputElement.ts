import { DisplayLine } from "../../Common/DisplayLine.ts";
import { BoxConstraints, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";
import { InputState } from "./InputState.ts";

// ─── Colors ─────────────────────────────────────────────────────────────────
const INPUT_FG = packRgb(204, 204, 204);
const INPUT_BG = packRgb(60, 60, 60);
const PLACEHOLDER_FG = packRgb(110, 110, 110);
const FOCUSED_BORDER_FG = packRgb(0x00, 0x7f, 0xd4); // #007FD4 — focusBorder from dark+
const UNFOCUSED_BORDER_FG = packRgb(0x3c, 0x3c, 0x3c); // #3C3C3C

export interface InputElementStyle {
    fg?: number;
    bg?: number;
}

/**
 * Single-line text input widget.
 *
 * By default rendered without a border — just a plain editable text line.
 * Set `showBorder = true` to get a Unicode box-drawing frame around it.
 * The border colour changes between focused (#007FD4) and unfocused (#3C3C3C).
 *
 * Usage:
 *   const input = new InputElement();
 *   input.placeholder = "Search…";
 *   input.onChange = value => console.log(value);
 */
export class InputElement extends TUIElement {
    public readonly inputState: InputState;
    public placeholder: string | undefined = undefined;
    public showBorder: boolean = false;
    public onChange: ((value: string) => void) | undefined = undefined;

    private scrollX: number = 0;

    public constructor(inputState?: InputState) {
        super();
        this.inputState = inputState ?? new InputState();
        this.tabIndex = 0;

        this.addEventListener("focus", () => {
            this.markDirty();
        });
        this.addEventListener("blur", () => {
            this.markDirty();
        });
    }

    // ─── Layout ─────────────────────────────────────────────────────────────

    public override getMinIntrinsicWidth(_height: number): number {
        return this.showBorder ? 5 : 3;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.showBorder ? 3 : 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.showBorder ? 3 : 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const height = this.showBorder ? 3 : 1;
        const width = Number.isFinite(constraints.maxWidth)
            ? constraints.maxWidth
            : Math.max(constraints.minWidth, 20);
        return super.performLayout(BoxConstraints.tight(new Size(width, height)));
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    public override render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.layoutSize.height;
        const text = this.inputState.text;
        const cursorOffset = this.inputState.cursorOffset;
        const focused = this.isFocused;

        const contentXStart = this.showBorder ? 1 : 0;
        const contentY = this.showBorder ? 1 : 0;
        const contentWidth = w - (this.showBorder ? 2 : 0);

        if (contentWidth <= 0) return;

        // Update horizontal scroll to keep cursor visible
        const dl = new DisplayLine(text);
        const cursorCol = dl.offsetToColumn(cursorOffset);
        if (cursorCol < this.scrollX) {
            this.scrollX = cursorCol;
        } else if (cursorCol >= this.scrollX + contentWidth) {
            this.scrollX = cursorCol - contentWidth + 1;
        }

        // Draw border
        if (this.showBorder) {
            this.renderBorder(context, w, h, focused);
        }

        // Fill content row background
        for (let x = contentXStart; x < contentXStart + contentWidth; x++) {
            context.setCell(x, contentY, { char: " ", fg: INPUT_FG, bg: INPUT_BG });
        }

        // Content area clip (screen-space coordinates)
        const contentClip = new Rect(
            new Point(this.globalPosition.x + contentXStart, this.globalPosition.y + contentY),
            new Size(contentWidth, 1),
        );
        const textContext = context.withClip(contentClip);

        // Draw text or placeholder
        if (text.length === 0 && this.placeholder !== undefined) {
            textContext.drawText(contentXStart, contentY, this.placeholder, { fg: PLACEHOLDER_FG, bg: INPUT_BG });
        } else {
            textContext.drawText(contentXStart - this.scrollX, contentY, text, { fg: INPUT_FG, bg: INPUT_BG });
        }

        // Hardware cursor
        if (focused) {
            const cursorX = contentXStart + (cursorCol - this.scrollX);
            if (cursorX >= contentXStart && cursorX < contentXStart + contentWidth) {
                context.setCursorPosition(cursorX, contentY);
            }
        }
    }

    private renderBorder(context: RenderContext, w: number, h: number, focused: boolean): void {
        const fg = focused ? FOCUSED_BORDER_FG : UNFOCUSED_BORDER_FG;
        const bg = INPUT_BG;

        // Top row: ┌───┐
        context.setCell(0, 0, { char: "┌", fg, bg });
        for (let x = 1; x < w - 1; x++) {
            context.setCell(x, 0, { char: "─", fg, bg });
        }
        context.setCell(w - 1, 0, { char: "┐", fg, bg });

        // Middle rows: │   │
        for (let y = 1; y < h - 1; y++) {
            context.setCell(0, y, { char: "│", fg, bg });
            context.setCell(w - 1, y, { char: "│", fg, bg });
        }

        // Bottom row: └───┘
        context.setCell(0, h - 1, { char: "└", fg, bg });
        for (let x = 1; x < w - 1; x++) {
            context.setCell(x, h - 1, { char: "─", fg, bg });
        }
        context.setCell(w - 1, h - 1, { char: "┘", fg, bg });
    }

    // ─── Input ──────────────────────────────────────────────────────────────

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type !== "keydown") return;
        const keyEvent = event as TUIKeyboardEvent;

        if (keyEvent.key === "Backspace") {
            event.preventDefault();
            this.inputState.deleteLeft();
            this.onChange?.(this.inputState.value);
            this.markDirty();
        } else if (keyEvent.key === "Delete") {
            event.preventDefault();
            this.inputState.deleteRight();
            this.onChange?.(this.inputState.value);
            this.markDirty();
        } else if (keyEvent.key === "ArrowLeft") {
            event.preventDefault();
            this.inputState.moveCursorLeft();
            this.markDirty();
        } else if (keyEvent.key === "ArrowRight") {
            event.preventDefault();
            this.inputState.moveCursorRight();
            this.markDirty();
        } else if (keyEvent.key === "Home") {
            event.preventDefault();
            this.inputState.moveCursorToStart();
            this.markDirty();
        } else if (keyEvent.key === "End") {
            event.preventDefault();
            this.inputState.moveCursorToEnd();
            this.markDirty();
        } else if (keyEvent.key.length === 1 && !keyEvent.ctrlKey && !keyEvent.altKey) {
            event.preventDefault();
            this.inputState.insert(keyEvent.key);
            this.onChange?.(this.inputState.value);
            this.markDirty();
        }
    }
}
