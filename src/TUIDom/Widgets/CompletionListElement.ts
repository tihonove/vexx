import { DisplayLine } from "../../Common/DisplayLine.ts";
import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { truncateEnd } from "../../Common/TextTruncation.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import type { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { kindIcon } from "./CompletionItemKindIcon.ts";

// ─── Colors (NvChad-подобная палитра) ────────────────────────────────────────
const BORDER_FG = packRgb(83, 83, 83);
const BG = packRgb(34, 34, 40);
const FG = packRgb(204, 204, 204);
const ACTIVE_SELECTION_BG = packRgb(56, 62, 90);
const ACTIVE_SELECTION_FG = packRgb(255, 255, 255);
const ICON_FG = packRgb(130, 170, 255);
const DETAIL_FG = packRgb(120, 120, 130);

// ─── Layout ───────────────────────────────────────────────────────────────────
// [│(0)][pad(1)][icon(2)][gap(3,4)][label…][…][pad(w-2)][│(w-1)]
const LABEL_X = 5;
const RIGHT_PAD = 1;
const MIN_WIDTH = 16;

/**
 * Элемент списка автодополнения (payload `data` непрозрачен для TUIDom — там
 * хранится core-item). `kind` — числовой `CompletionItemKind` для иконки.
 */
export interface CompletionListItem {
    readonly label: string;
    readonly detail?: string;
    readonly kind?: number;
    readonly data?: unknown;
}

/**
 * Компактный дропдаун автодополнения в стиле NvChad: скруглённая рамка,
 * выбранный ряд подсвечивается фоном (без указателей), 1-ячейка паддинга от
 * рамки, колонка codicon-иконки типа. Собственной строки ввода нет — фильтр
 * внутренний (набор символов сужает список, не трогая буфер редактора).
 *
 * Клавиши (self-focused, `performDefaultAction`):
 *   ↑/↓            — навигация (clamp, без wrap)
 *   Enter / Tab    — `onAccept(item)`
 *   Escape         — `onCancel()`
 *   печатный / Backspace — правит внутренний `filter` → `onFilterChange`
 */
export class CompletionListElement extends TUIElement {
    public maxVisibleItems = 10;
    public preferredWidth = 40;

    public onAccept: ((item: CompletionListItem) => void) | null = null;
    public onCancel: (() => void) | null = null;
    public onFilterChange: ((filter: string) => void) | null = null;

    private allItems: readonly CompletionListItem[] = [];
    private filteredItems: readonly CompletionListItem[] = [];
    private filterValue = "";
    private selectedIndexValue = 0;
    private scrollOffset = 0;

    public constructor() {
        super();
        this.tabIndex = 0;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Задаёт полный набор элементов; переприменяет текущий фильтр. */
    public setItems(items: readonly CompletionListItem[]): void {
        this.allItems = items;
        this.applyFilter();
    }

    /** Текущий внутренний фильтр (префикс + добор в попапе). */
    public get filter(): string {
        return this.filterValue;
    }

    public setFilter(value: string): void {
        this.filterValue = value;
        this.applyFilter();
    }

    /** Видимые (отфильтрованные) элементы. */
    public get items(): readonly CompletionListItem[] {
        return this.filteredItems;
    }

    public get selectedIndex(): number {
        return this.selectedIndexValue;
    }

    public getSelectedItem(): CompletionListItem | null {
        return this.filteredItems[this.selectedIndexValue] ?? null;
    }

    // ─── Filtering ───────────────────────────────────────────────────────────

    private applyFilter(): void {
        const needle = this.filterValue.toLowerCase();
        this.filteredItems =
            needle === ""
                ? this.allItems
                : this.allItems.filter((item) => matchText(item).toLowerCase().includes(needle));
        this.selectedIndexValue = 0;
        this.scrollOffset = 0;
        this.markDirty();
    }

    // ─── Sizing ──────────────────────────────────────────────────────────────

    private get visibleItemCount(): number {
        return Math.min(this.filteredItems.length, this.maxVisibleItems);
    }

    private get contentWidth(): number {
        let max = 0;
        for (const item of this.filteredItems) {
            const labelW = new DisplayLine(item.label).displayWidth;
            const detailW =
                item.detail !== undefined && item.detail !== "" ? 2 + new DisplayLine(item.detail).displayWidth : 0;
            max = Math.max(max, labelW + detailW);
        }
        return max;
    }

    private get boxWidth(): number {
        const natural = LABEL_X + this.contentWidth + RIGHT_PAD + 1; // +1 правая рамка
        return Math.max(MIN_WIDTH, Math.min(this.preferredWidth, natural));
    }

    private get boxHeight(): number {
        return this.visibleItemCount + 2; // рамка сверху/снизу
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.boxWidth;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.boxWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.boxHeight;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.boxHeight;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = constraints.constrain(new Size(this.boxWidth, this.boxHeight));
        super.performLayout(BoxConstraints.tight(size));
        return size;
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    public override render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.boxHeight;

        // Фон
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.setCell(x, y, { char: " ", fg: FG, bg: BG });
            }
        }

        // Скруглённая рамка сверху ╭───╮
        context.setCell(0, 0, { char: "╭", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) context.setCell(x, 0, { char: "─", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 0, { char: "╮", fg: BORDER_FG, bg: BG });

        // Ряды
        for (let i = 0; i < this.visibleItemCount; i++) {
            this.renderRow(context, w, 1 + i, this.scrollOffset + i);
        }

        // Скруглённая рамка снизу ╰───╯
        const bottomY = h - 1;
        context.setCell(0, bottomY, { char: "╰", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) context.setCell(x, bottomY, { char: "─", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, bottomY, { char: "╯", fg: BORDER_FG, bg: BG });
    }

    private renderRow(context: RenderContext, w: number, rowY: number, itemIndex: number): void {
        const item = this.filteredItems[itemIndex];
        const isSelected = itemIndex === this.selectedIndexValue;
        const rowBg = isSelected ? ACTIVE_SELECTION_BG : BG;
        const rowFg = isSelected ? ACTIVE_SELECTION_FG : FG;

        // Фон ряда + боковые рамки
        for (let x = 0; x < w; x++) context.setCell(x, rowY, { char: " ", fg: rowFg, bg: rowBg });
        context.setCell(0, rowY, { char: "│", fg: BORDER_FG, bg: rowBg });
        context.setCell(w - 1, rowY, { char: "│", fg: BORDER_FG, bg: rowBg });

        // Иконка типа
        const icon = kindIcon(item.kind);
        context.drawText(2, rowY, icon, { fg: isSelected ? rowFg : ICON_FG, bg: rowBg });

        // Правый блок: detail (dim, right-aligned)
        const contentRight = w - 1 - RIGHT_PAD; // exclusive
        let rightWidth = 0;
        if (item.detail !== undefined && item.detail !== "") {
            const detailText = "  " + item.detail;
            const detailW = new DisplayLine(detailText).displayWidth;
            if (LABEL_X + 1 + detailW <= contentRight) {
                context.drawText(contentRight - detailW, rowY, detailText, {
                    fg: isSelected ? rowFg : DETAIL_FG,
                    bg: rowBg,
                });
                rightWidth = detailW;
            }
        }

        // Label (приоритет, усечение по остатку)
        const labelAvail = Math.max(0, contentRight - rightWidth - LABEL_X);
        const labelNatural = new DisplayLine(item.label).displayWidth;
        const labelText = labelNatural <= labelAvail ? item.label : truncateEnd(item.label, labelAvail);
        context.drawText(LABEL_X, rowY, labelText, { fg: rowFg, bg: rowBg }, { maxWidth: labelAvail });
    }

    // ─── Keyboard ────────────────────────────────────────────────────────────

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type !== "keydown") return;
        const keyEvent = event as TUIKeyboardEvent;
        switch (keyEvent.key) {
            case "ArrowDown":
                event.preventDefault();
                this.moveSelection(1);
                return;
            case "ArrowUp":
                event.preventDefault();
                this.moveSelection(-1);
                return;
            case "Enter":
            case "Tab": {
                event.preventDefault();
                const item = this.getSelectedItem();
                if (item !== null) this.onAccept?.(item);
                return;
            }
            case "Escape":
                event.preventDefault();
                this.onCancel?.();
                return;
            case "Backspace":
                event.preventDefault();
                if (this.filterValue.length > 0) {
                    this.setFilter(this.filterValue.slice(0, -1));
                    this.onFilterChange?.(this.filterValue);
                }
                return;
        }
        if (keyEvent.key.length === 1 && !keyEvent.ctrlKey && !keyEvent.altKey && !keyEvent.metaKey) {
            event.preventDefault();
            this.setFilter(this.filterValue + keyEvent.key);
            this.onFilterChange?.(this.filterValue);
        }
    }

    private moveSelection(delta: number): void {
        if (this.filteredItems.length === 0) return;
        const next = Math.max(0, Math.min(this.filteredItems.length - 1, this.selectedIndexValue + delta));
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

/** Текст, по которому фильтруем: label (detail не участвует в фильтрации). */
function matchText(item: CompletionListItem): string {
    return item.label;
}
