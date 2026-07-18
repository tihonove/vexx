import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { OverlayLayer, OverlaySessionHandle } from "./OverlayLayer.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";

/** One selectable entry — `value` is the identity, `label` is what the user sees. */
export interface DropdownOption {
    readonly value: string;
    readonly label: string;
}

// Defaults preserve a usable look without a theme; owners push `dropdown.*` via applyTheme.
const DROPDOWN_FG = packRgb(204, 204, 204);
const DROPDOWN_BG = packRgb(60, 60, 60);
const DROPDOWN_BORDER = packRgb(60, 60, 60);

/** Drop-down glyph appended after the label (▾). */
const ARROW = "▾";
/** Marker glyph on the currently-selected list row (✓). */
const CHECK = "✓";

/**
 * Select-подобный контрол (аналог HTML `<select>`): закрытый бокс показывает
 * текущую опцию + стрелку, по клику/Enter/Space/↓ раскрывает список опций поверх
 * (переиспользуя {@link PopupMenuElement} в оверлее). Самодостаточен — хосту нужно
 * лишь задать `options`/`value`, подписаться на `onChange` и отдать `OverlayLayer`
 * через {@link setOverlayLayer}. Цвета — из ключей темы `dropdown.*`.
 */
export class DropdownElement extends TUIElement {
    /** Fired ТОЛЬКО при выборе пользователем (не при программном `value = …`). */
    public onChange?: (value: string) => void;
    /** Shown when there is no current value (empty options / value === null). */
    public placeholder = "";

    private optionList: DropdownOption[];
    private currentValue: string | null = null;
    private overlay: OverlayLayer | null = null;
    private theme: WorkbenchTheme | null = null;
    private session: OverlaySessionHandle | null = null;

    private fg = DROPDOWN_FG;
    private bg = DROPDOWN_BG;
    private borderColor = DROPDOWN_BORDER;

    public constructor(options: DropdownOption[] = []) {
        super();
        this.optionList = options;
        this.tabIndex = 0;

        this.addEventListener("focus", () => this.markDirty());
        this.addEventListener("blur", () => this.markDirty());
        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.toggle();
        });
    }

    public get options(): readonly DropdownOption[] {
        return this.optionList;
    }

    public set options(next: readonly DropdownOption[]) {
        this.optionList = [...next];
        this.markDirty();
    }

    public get value(): string | null {
        return this.currentValue;
    }

    /** Программная установка — меняет отображение, но НЕ шлёт `onChange`. */
    public set value(next: string | null) {
        if (this.currentValue === next) return;
        this.currentValue = next;
        this.markDirty();
    }

    public setOverlayLayer(overlay: OverlayLayer): void {
        this.overlay = overlay;
    }

    /** Цвета закрытого бокса из ключей `dropdown.*`; список берёт `dropdown.listBackground`. */
    public applyTheme(theme: WorkbenchTheme): void {
        this.theme = theme;
        this.fg = theme.getRequiredColor("dropdown.foreground");
        this.bg = theme.getRequiredColor("dropdown.background");
        this.borderColor = theme.getRequiredColor("dropdown.border");
        this.markDirty();
    }

    public isOpen(): boolean {
        return this.session !== null && this.session.isOpen();
    }

    public open(): void {
        if (this.overlay === null || this.isOpen()) return;
        if (this.optionList.length === 0) return;

        const menu = new PopupMenuElement(
            this.optionList.map((opt) => ({
                label: opt.label,
                icon: opt.value === this.currentValue ? CHECK : undefined,
                onSelect: () => this.select(opt.value),
            })),
        );
        if (this.theme !== null) menu.applyTheme(this.theme);
        menu.tabIndex = 0;

        this.session = this.overlay.openPopupSession(
            menu,
            { screenX: this.globalPosition.x, screenY: this.globalPosition.y },
            {
                visible: true,
                pointerPolicy: "close-on-outside",
                closeOnEscape: true,
                focusOnOpen: true,
                restoreFocus: true,
                disposeOnClose: true,
                onClose: () => {
                    this.session = null;
                    this.markDirty();
                },
            },
        );
        this.markDirty();
    }

    public close(): void {
        this.session?.close();
        this.session = null;
    }

    private toggle(): void {
        if (this.isOpen()) this.close();
        else this.open();
    }

    private select(value: string): void {
        this.close();
        if (this.currentValue === value) return; // choosing the current value is a no-op, like <select>
        this.currentValue = value;
        this.markDirty();
        this.onChange?.(value);
    }

    /** Widest label (or placeholder) + leading space + arrow + surrounding padding. */
    private intrinsicWidth(): number {
        let longest = this.placeholder.length;
        for (const opt of this.optionList) longest = Math.max(longest, opt.label.length);
        return longest + 4; // " " + label + " " + arrow
    }

    private displayText(): string {
        if (this.currentValue === null) return this.placeholder;
        const active = this.optionList.find((opt) => opt.value === this.currentValue);
        return active?.label ?? this.currentValue;
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.intrinsicWidth();
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.intrinsicWidth();
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        return super.performLayout(BoxConstraints.tight(new Size(this.intrinsicWidth(), 1)));
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type !== "keydown") return;
        const keyEvent = event as TUIKeyboardEvent;
        // Escape-to-close is handled by the overlay session (closeOnEscape) once the
        // list is open; here we only open the list.
        if (keyEvent.key === "Enter" || keyEvent.key === " " || keyEvent.key === "ArrowDown") {
            event.preventDefault();
            this.open();
        }
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        const style = this.isFocused ? StyleFlags.Underline : StyleFlags.None;

        // Fill the control background.
        for (let x = 0; x < width; x++) context.setCell(x, 0, { char: " ", bg: this.bg });

        // ` label` left-aligned, `▾` pinned to the right edge.
        context.drawText(1, 0, this.displayText(), { fg: this.fg, bg: this.bg, style }, { maxWidth: width - 2 });
        context.setCell(width - 1, 0, { char: ARROW, fg: this.borderColor, bg: this.bg });
    }
}
