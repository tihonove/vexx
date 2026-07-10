import { packRgb } from "../../Rendering/ColorUtils.ts";
import { CompositeElement } from "../CompositeElement.ts";
import type { JsxNode } from "../JSX/jsx-runtime.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { HFlex, hflexFill, hflexFit, hflexFixed } from "./HFlexElement.ts";
import { TextLabel } from "./TextLabelElement.ts";

/** Цвета выпадающего меню (ключи VS Code `menu.*`). */
export interface MenuColors {
    /** menu.foreground */
    fg: number;
    /** menu.background */
    bg: number;
    /** menu.selectionForeground */
    highlightFg: number;
    /** menu.selectionBackground */
    highlightBg: number;
    /** Приглушённый цвет шортката (нет прямого ключа VS Code). */
    shortcutFg: number;
    /** menu.border */
    borderFg: number;
    /** menu.separatorBackground */
    separatorFg: number;
}

/** Дефолты в цветах VS Code Dark+ — используются, пока тема не задала `menu.*`. */
export const DEFAULT_MENU_COLORS: MenuColors = {
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
    private colorsValue: MenuColors;

    public constructor(
        label: string,
        config: PopupMenuItemConfig,
        shortcut?: string,
        icon?: string,
        colors: MenuColors = DEFAULT_MENU_COLORS,
    ) {
        super();
        this.label = label;
        this.config = config;
        this.shortcut = shortcut;
        this.icon = icon;
        this.colorsValue = colors;

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

    public set colors(value: MenuColors) {
        this.colorsValue = value;
        this.rebuild();
    }

    public describe(): JsxNode {
        const colors = this.colorsValue;
        const fg = this.selectedValue ? colors.highlightFg : colors.fg;
        const bg = this.selectedValue ? colors.highlightBg : colors.bg;

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
                        fg={this.selectedValue ? colors.highlightFg : colors.shortcutFg}
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
    private colorsValue: MenuColors;

    public constructor(colors: MenuColors = DEFAULT_MENU_COLORS) {
        super();
        this.colorsValue = colors;
    }

    public set colors(value: MenuColors) {
        this.colorsValue = value;
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
            context.setCell(x, 0, { char: "─", fg: this.colorsValue.separatorFg, bg: this.colorsValue.bg });
        }
    }
}
