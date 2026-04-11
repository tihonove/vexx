import process from "node:process";

import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { CompositeElement } from "../CompositeElement.ts";
import type { JsxNode } from "../JSX/jsx-runtime.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { HFlex, hflexFill, hflexFit, hflexFixed } from "./HFlexElement.ts";
import { TextLabel } from "./TextLabelElement.ts";

export const HIGHLIGHT_BG = packRgb(0, 90, 180);
export const HIGHLIGHT_FG = packRgb(255, 255, 255);
export const MENU_FG = DEFAULT_COLOR;
export const MENU_BG = DEFAULT_COLOR;
export const SHORTCUT_FG = packRgb(128, 128, 128);

export interface PopupMenuItemConfig {
    hasIconColumn: boolean;
    hasShortcuts: boolean;
}

export class PopupMenuItemElement extends CompositeElement {
    public readonly label: string;
    public readonly shortcut: string | undefined;
    public readonly icon: string | undefined;
    public onSelect?: () => void;
    private readonly config: PopupMenuItemConfig;
    private selectedValue = false;

    public constructor(label: string, config: PopupMenuItemConfig, shortcut?: string, icon?: string) {
        super();
        this.label = label;
        this.config = config;
        this.shortcut = shortcut;
        this.icon = icon;

        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onSelect?.();
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

    public describe(): JsxNode {
        const fg = this.selectedValue ? HIGHLIGHT_FG : MENU_FG;
        const bg = this.selectedValue ? HIGHLIGHT_BG : MENU_BG;

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
                        fg={this.selectedValue ? HIGHLIGHT_FG : SHORTCUT_FG}
                        bg={bg}
                        layout={{ width: hflexFit(), height: "fill" }}
                    />
                ) : null}
                {!this.config.hasShortcuts ? (
                    <TextLabel text=" " fg={fg} bg={bg} layout={{ width: hflexFixed(1), height: "fill" }} />
                ) : null}
            </HFlex>
        );
    }
}

export class PopupMenuSeparatorElement extends TUIElement {
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
            context.setCell(x, 0, { char: "─", fg: DEFAULT_COLOR, bg: DEFAULT_COLOR });
        }
    }
}
