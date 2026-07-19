import { packRgb } from "../../../common/colorUtils.ts";
import { CompositeElement } from "../../compositeElement.ts";
import type { JsxNode } from "../../jsx/jsx-runtime.ts";
import { RenderContext, TUIElement } from "../../tuiElement.ts";

import { HFlex, hflexFill, hflexFit, hflexFixed } from "../layout/hFlexElement.ts";
import { TextLabel } from "../text/textLabelElement.ts";

/** Цвета выпадающего меню (ключи VS Code `menu.*`). */
export interface IMenuStyles {
    /** menu.foreground */
    readonly fg: number;
    /** menu.background */
    readonly bg: number;
    /** menu.selectionForeground */
    readonly highlightFg: number;
    /** menu.selectionBackground */
    readonly highlightBg: number;
    /** Приглушённый цвет шортката (нет прямого ключа VS Code). */
    readonly shortcutFg: number;
    /** menu.border */
    readonly borderFg: number;
    /** menu.separatorBackground */
    readonly separatorFg: number;
}

/** Дефолты в цветах VS Code Dark+ — используются, пока владелец не задал стили. */
export const unthemedMenuStyles: IMenuStyles = {
    fg: packRgb(204, 204, 204), // #cccccc
    bg: packRgb(37, 37, 38), // #252526
    highlightFg: packRgb(255, 255, 255), // #ffffff
    highlightBg: packRgb(4, 57, 94), // #04395e
    shortcutFg: packRgb(128, 128, 128), // #808080
    borderFg: packRgb(83, 83, 83), // #535353
    separatorFg: packRgb(83, 83, 83), // #535353
};

export interface PopupMenuItemConfig {
    hasIconColumn: boolean;
    hasShortcuts: boolean;
}

export class PopupMenuItemElement extends CompositeElement {
    public readonly label: string;
    public readonly shortcut: string | undefined;
    public readonly icon: string | undefined;
    public onSelect?: () => void;
    /** Fired when the mouse moves over this item — used to follow the cursor with the selection. */
    public onHover?: () => void;
    private readonly config: PopupMenuItemConfig;
    private selectedValue = false;
    private styles: IMenuStyles;

    public constructor(
        label: string,
        config: PopupMenuItemConfig,
        shortcut?: string,
        icon?: string,
        styles: IMenuStyles = unthemedMenuStyles,
    ) {
        super();
        this.label = label;
        this.config = config;
        this.shortcut = shortcut;
        this.icon = icon;
        this.styles = styles;

        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onSelect?.();
        });

        // Follow the mouse: hovering an item moves the menu selection onto it (VS Code behavior).
        this.addEventListener("mousemove", (event) => {
            if (event.defaultPrevented) return;
            this.onHover?.();
        });

        this.rebuild();
    }

    public get selected(): boolean {
        return this.selectedValue;
    }

    public set selected(value: boolean) {
        if (this.selectedValue === value) return;
        this.selectedValue = value;
        this.rebuild();
    }

    public setStyles(styles: IMenuStyles): void {
        this.styles = styles;
        this.rebuild();
    }

    public describe(): JsxNode {
        const styles = this.styles;
        const fg = this.selectedValue ? styles.highlightFg : styles.fg;
        const bg = this.selectedValue ? styles.highlightBg : styles.bg;

        const labelText = this.config.hasShortcuts ? this.label + " " : this.label;

        return (
            <HFlex>
                {this.config.hasIconColumn ? (
                    <TextLabel
                        text={this.icon ? this.icon + " " : "  "}
                        fg={fg}
                        bg={bg}
                        layout={{ width: hflexFixed(2), height: "fill" }}
                    />
                ) : (
                    <TextLabel text=" " fg={fg} bg={bg} layout={{ width: hflexFixed(1), height: "fill" }} />
                )}
                <TextLabel text={labelText} fg={fg} bg={bg} layout={{ width: hflexFill(), height: "fill" }} />
                {this.config.hasShortcuts && this.shortcut ? (
                    <TextLabel
                        text={"  " + this.shortcut}
                        fg={this.selectedValue ? styles.highlightFg : styles.shortcutFg}
                        bg={bg}
                        layout={{ width: hflexFit(), height: "fill" }}
                    />
                ) : null}
                <TextLabel text=" " fg={fg} bg={bg} layout={{ width: hflexFixed(1), height: "fill" }} />
            </HFlex>
        );
    }
}

export class PopupMenuSeparatorElement extends TUIElement {
    private styles: IMenuStyles;

    public constructor(styles: IMenuStyles = unthemedMenuStyles) {
        super();
        this.styles = styles;
    }

    public setStyles(styles: IMenuStyles): void {
        this.styles = styles;
        this.markDirty();
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return 0;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return 0;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        for (let x = 0; x < width; x++) {
            context.setCell(x, 0, { char: "─", fg: this.styles.separatorFg, bg: this.styles.bg });
        }
    }
}
