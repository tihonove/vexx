import { DisplayLine } from "../../Common/DisplayLine.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { InputElement } from "./InputElement.ts";

// ─── Colors ─────────────────────────────────────────────────────────────────
const BORDER_FG = packRgb(83, 83, 83);
const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const ACTIVE_SELECTION_BG = packRgb(4, 57, 94);
const ACTIVE_SELECTION_FG = packRgb(255, 255, 255);
const MATCH_FG = packRgb(100, 200, 255);
const DESCRIPTION_FG = packRgb(125, 125, 125);
const BADGE_FG = packRgb(150, 190, 100);
const SHORTCUT_FG = packRgb(128, 128, 128);
const HINT_FG = packRgb(100, 150, 200);

// ─── Public types ────────────────────────────────────────────────────────────

export interface QuickPickItem {
    /** Nerd font icon character (e.g. a file icon like "\uf15b"). */
    icon?: string;
    /** Main display text. */
    label: string;
    /** Right-side text: file path, category, etc. */
    description?: string;
    /** Keyboard shortcut shown right-aligned, e.g. "Ctrl+Shift+P". */
    shortcut?: string;
    /** Action hint shown after description, e.g. "Configure Binding". */
    hint?: string;
    /** Marker badge, e.g. "recently used". */
    badge?: string;
    /** Byte-offset ranges in `label` to highlight as fuzzy-match hits. */
    labelMatchRanges?: readonly [number, number][];
    /** Byte-offset ranges in `description` to highlight as fuzzy-match hits. */
    descriptionMatchRanges?: readonly [number, number][];
}

// ─── Widget ──────────────────────────────────────────────────────────────────

/**
 * Quick-open / command-palette style picker.
 *
 * Renders a bordered box with:
 *   - top row: text input (query)
 *   - optional separator + scrollable item list below
 *
 * The widget does NOT perform any filtering itself — pass pre-filtered
 * `items` with `labelMatchRanges`/`descriptionMatchRanges` populated.
 *
 * Keyboard:
 *   ArrowDown/Up   — move selection (no wrap)
 *   Enter          — fire `onAccept(item, index)`
 *   Escape         — fire `onCancel()`
 *   All other keys — forwarded to the InputElement (typing)
 *
 * Usage:
 *   const picker = new QuickPickElement();
 *   picker.placeholder = "Go to file…";
 *   picker.onQueryChange = query => { picker.items = search(query); };
 *   picker.onAccept = (item) => openFile(item.description!);
 */
export class QuickPickElement extends TUIElement {
    public placeholder = "Type to search…";
    /** Maximum rows of the list to show at once (scrolls when exceeded). */
    public maxVisibleItems = 10;
    /**
     * Desired width of the picker in columns.
     * When the element is laid out with loose constraints it will use this
     * value (clamped to [minWidth, maxWidth]).
     */
    public preferredWidth = 60;

    /** Colours exposed for theming. */
    public activeSelectionBg: number = ACTIVE_SELECTION_BG;
    public activeSelectionFg: number = ACTIVE_SELECTION_FG;
    public matchFg: number = MATCH_FG;

    public onQueryChange: ((query: string) => void) | null = null;
    public onAccept: ((item: QuickPickItem, index: number) => void) | null = null;
    public onCancel: (() => void) | null = null;

    public readonly inputElement: InputElement;

    private itemsValue: readonly QuickPickItem[] = [];
    private selectedIndexValue = 0;
    private scrollOffset = 0;

    public constructor() {
        super();
        this.tabIndex = 0;

        this.inputElement = new InputElement();
        this.inputElement.showBorder = false;
        this.inputElement.setParent(this);

        this.inputElement.onChange = (value) => {
            this.onQueryChange?.(value);
        };

        // Handle navigation keys that bubble up from the focused InputElement.
        // These keys are not consumed by InputElement.performDefaultAction, so they
        // bubble here. We preventDefault() to suppress further handling.
        this.addEventListener("keydown", (event) => {
            const keyEvent = event;
            switch (keyEvent.key) {
                case "ArrowDown":
                    event.preventDefault();
                    this.moveSelection(1);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    this.moveSelection(-1);
                    break;
                case "Enter":
                    event.preventDefault();
                    if (this.itemsValue.length > 0) {
                        this.onAccept?.(this.itemsValue[this.selectedIndexValue], this.selectedIndexValue);
                    }
                    break;
                case "Escape":
                    event.preventDefault();
                    this.onCancel?.();
                    break;
            }
        });
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    public get items(): readonly QuickPickItem[] {
        return this.itemsValue;
    }

    public set items(value: readonly QuickPickItem[]) {
        this.itemsValue = value;
        this.selectedIndexValue = 0;
        this.scrollOffset = 0;
        this.markDirty();
    }

    public get selectedIndex(): number {
        return this.selectedIndexValue;
    }

    public getQuery(): string {
        return this.inputElement.inputState.value;
    }

    public setQuery(value: string): void {
        this.inputElement.inputState.value = value;
        this.markDirty();
    }

    /** Delegate focus to the inner InputElement. */
    public override focus(): void {
        this.inputElement.focus();
    }

    // ─── Layout ─────────────────────────────────────────────────────────────

    private get visibleItemCount(): number {
        return Math.min(this.itemsValue.length, this.maxVisibleItems);
    }

    private get totalHeight(): number {
        const listRows = this.visibleItemCount;
        if (listRows === 0) {
            // top border + input row + bottom border
            return 3;
        }
        // top border + input row + separator + list rows + bottom border
        return 4 + listRows;
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return 20;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.preferredWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.totalHeight;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.totalHeight;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const maxW = Number.isFinite(constraints.maxWidth) ? constraints.maxWidth : this.preferredWidth;
        const width = Math.max(constraints.minWidth, Math.min(this.preferredWidth, maxW));
        // Always use natural height — QuickPickElement is self-sizing vertically.
        // Callers may allocate more rows, but we only occupy what we need.
        const size = new Size(width, this.totalHeight);

        super.performLayout(BoxConstraints.tight(size));

        // Position InputElement inside the top border, padded by 1 on each side.
        const inputWidth = Math.max(0, size.width - 2);
        this.inputElement.localPosition = new Offset(1, 1);
        this.inputElement.globalPosition = new Point(this.globalPosition.x + 1, this.globalPosition.y + 1);
        this.inputElement.performLayout(BoxConstraints.tight(new Size(inputWidth, 1)));

        return size;
    }

    // ─── Children ───────────────────────────────────────────────────────────

    public override getChildren(): readonly TUIElement[] {
        return [this.inputElement];
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    public override render(context: RenderContext): void {
        const w = this.layoutSize.width;
        // Use natural height, not the (potentially larger) allocated layoutSize.height.
        // This prevents a visual gap between the last item and the bottom border when
        // the parent container allocates more vertical space than needed.
        const h = this.totalHeight;
        const hasItems = this.visibleItemCount > 0;

        // ── Background fill ──────────────────────────────────────────────────
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.setCell(x, y, { char: " ", fg: FG, bg: BG });
            }
        }

        // ── Top border ───────────────────────────────────────────────────────
        context.setCell(0, 0, { char: "┌", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) {
            context.setCell(x, 0, { char: "─", fg: BORDER_FG, bg: BG });
        }
        context.setCell(w - 1, 0, { char: "┐", fg: BORDER_FG, bg: BG });

        // ── Input row side borders ────────────────────────────────────────────
        context.setCell(0, 1, { char: "│", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 1, { char: "│", fg: BORDER_FG, bg: BG });

        // ── Render InputElement ───────────────────────────────────────────────
        // Give it an explicit placeholder since we own the visual chrome.
        this.inputElement.placeholder = this.placeholder;
        const inputClip = new Rect(this.inputElement.globalPosition, this.inputElement.layoutSize);
        const inputOffset = new Offset(this.inputElement.localPosition.dx, this.inputElement.localPosition.dy);
        this.inputElement.render(context.withOffset(inputOffset).withClip(inputClip));

        if (hasItems) {
            // ── Separator ─────────────────────────────────────────────────────
            context.setCell(0, 2, { char: "├", fg: BORDER_FG, bg: BG });
            for (let x = 1; x < w - 1; x++) {
                context.setCell(x, 2, { char: "─", fg: BORDER_FG, bg: BG });
            }
            context.setCell(w - 1, 2, { char: "┤", fg: BORDER_FG, bg: BG });

            // ── Item rows ─────────────────────────────────────────────────────
            const hasIcons = this.itemsValue.some((item) => item.icon !== undefined);
            for (let i = 0; i < this.visibleItemCount; i++) {
                const itemIndex = this.scrollOffset + i;
                this.renderItemRow(context, w, 3 + i, itemIndex, hasIcons);
            }

            // ── Bottom border ─────────────────────────────────────────────────
            const bottomY = h - 1;
            context.setCell(0, bottomY, { char: "└", fg: BORDER_FG, bg: BG });
            for (let x = 1; x < w - 1; x++) {
                context.setCell(x, bottomY, { char: "─", fg: BORDER_FG, bg: BG });
            }
            context.setCell(w - 1, bottomY, { char: "┘", fg: BORDER_FG, bg: BG });
        } else {
            // ── Bottom border (no items) ──────────────────────────────────────
            context.setCell(0, 2, { char: "└", fg: BORDER_FG, bg: BG });
            for (let x = 1; x < w - 1; x++) {
                context.setCell(x, 2, { char: "─", fg: BORDER_FG, bg: BG });
            }
            context.setCell(w - 1, 2, { char: "┘", fg: BORDER_FG, bg: BG });
        }
    }

    private renderItemRow(context: RenderContext, w: number, rowY: number, itemIndex: number, hasIcons: boolean): void {
        const item = this.itemsValue[itemIndex];
        const isSelected = itemIndex === this.selectedIndexValue;
        const rowBg = isSelected ? this.activeSelectionBg : BG;
        const rowFg = isSelected ? this.activeSelectionFg : FG;

        // ── Row background ────────────────────────────────────────────────────
        for (let x = 0; x < w; x++) {
            context.setCell(x, rowY, { char: " ", fg: rowFg, bg: rowBg });
        }

        // ── Side borders ──────────────────────────────────────────────────────
        context.setCell(0, rowY, { char: "│", fg: BORDER_FG, bg: rowBg });
        context.setCell(w - 1, rowY, { char: "│", fg: BORDER_FG, bg: rowBg });

        let x = 2;

        // ── Icon column ───────────────────────────────────────────────────────
        if (hasIcons) {
            const icon = item.icon ?? " ";
            context.setCell(x, rowY, { char: icon, fg: rowFg, bg: rowBg });
            x += 2; // icon char + trailing space
        }

        // ── Right-side text: badge, description, shortcut, hint ───────────────
        interface RightPart {
            text: string;
            fg: number;
        }
        const rightParts: RightPart[] = [];

        if (item.badge !== undefined) {
            rightParts.push({ text: " ★ " + item.badge, fg: BADGE_FG });
        }
        if (item.description !== undefined) {
            rightParts.push({
                text: "  " + item.description,
                fg: isSelected ? this.activeSelectionFg : DESCRIPTION_FG,
            });
        }
        if (item.shortcut !== undefined) {
            rightParts.push({
                text: "  " + item.shortcut,
                fg: isSelected ? this.activeSelectionFg : SHORTCUT_FG,
            });
        }
        if (item.hint !== undefined) {
            rightParts.push({
                text: "  " + item.hint,
                fg: isSelected ? this.activeSelectionFg : HINT_FG,
            });
        }

        // Width of right column (approximate — no wide chars in metadata fields)
        const rightTotalWidth = rightParts.reduce((sum, p) => sum + new DisplayLine(p.text).displayWidth, 0);

        // ── Label ─────────────────────────────────────────────────────────────
        const contentRight = w - 2; // exclusive, inside right border
        const labelMaxWidth = Math.max(0, contentRight - x - rightTotalWidth);
        const matchSet = buildMatchSet(item.labelMatchRanges ?? []);
        const labelDl = new DisplayLine(item.label);
        const actualLabelWidth = Math.min(labelMaxWidth, labelDl.displayWidth);

        context.drawText(
            x,
            rowY,
            item.label,
            { fg: rowFg, bg: rowBg },
            {
                maxWidth: actualLabelWidth,
                getStyle: (offset) => {
                    if (matchSet.has(offset)) {
                        return { fg: isSelected ? this.activeSelectionFg : this.matchFg };
                    }
                    return undefined;
                },
            },
        );

        // ── Right parts (right-aligned) ───────────────────────────────────────
        let rx = contentRight - rightTotalWidth;
        for (const part of rightParts) {
            const partWidth = new DisplayLine(part.text).displayWidth;
            context.drawText(rx, rowY, part.text, { fg: part.fg, bg: rowBg });
            rx += partWidth;
        }
    }

    // ─── Selection ───────────────────────────────────────────────────────────

    private moveSelection(delta: number): void {
        if (this.itemsValue.length === 0) return;
        const next = Math.max(0, Math.min(this.itemsValue.length - 1, this.selectedIndexValue + delta));
        if (next === this.selectedIndexValue) return;
        this.selectedIndexValue = next;
        this.ensureVisible(next);
        this.markDirty();
    }

    private ensureVisible(index: number): void {
        if (index < this.scrollOffset) {
            this.scrollOffset = index;
        } else if (index >= this.scrollOffset + this.visibleItemCount) {
            this.scrollOffset = index - this.visibleItemCount + 1;
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Expands [start, end) range pairs into a flat Set of matched byte offsets,
 * for per-character colour lookups in `drawText.getStyle`.
 */
function buildMatchSet(ranges: readonly [number, number][]): Set<number> {
    const set = new Set<number>();
    for (const [start, end] of ranges) {
        for (let i = start; i < end; i++) {
            set.add(i);
        }
    }
    return set;
}
