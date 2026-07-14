import { parseHexColor } from "../../../../platform/theme/common/colorUtils.ts";
import { defaultWorkbenchColors, themeKindOf } from "../../../../platform/theme/common/colorRegistry.ts";
import type { IEditorTokenTheme } from "./editorTokenTheme.ts";
import type { IThemeFile } from "./themeFile.ts";
import type { IWorkbenchColors } from "../../../../platform/theme/common/colors.ts";

/**
 * The active workbench color theme.
 * Holds packed RGB colors (converted from hex at load time)
 * and token rules for syntax highlighting.
 */
export class WorkbenchTheme {
    public readonly name: string;
    public readonly type: "dark" | "light" | "hc" | "hcLight";
    public readonly colors: IWorkbenchColors;
    public readonly tokenTheme: IEditorTokenTheme;

    public constructor(
        name: string,
        type: "dark" | "light" | "hc" | "hcLight",
        colors: IWorkbenchColors,
        tokenTheme: IEditorTokenTheme,
    ) {
        this.name = name;
        this.type = type;
        this.colors = colors;
        this.tokenTheme = tokenTheme;
    }

    /**
     * Create a WorkbenchTheme from a VS Code theme JSON object.
     *
     * The default color registry for the theme's kind (dark/light) is layered
     * UNDER the theme's own colors, so any workbench color the app reads
     * resolves on every theme — mirroring how VS Code fills unset colors from
     * its built-in defaults. See {@link defaultWorkbenchColors}.
     *
     * All hex color strings are converted to packed 24-bit RGB integers.
     */
    public static fromThemeFile(json: IThemeFile): WorkbenchTheme {
        const merged = { ...defaultWorkbenchColors(themeKindOf(json.type)), ...json.colors };
        const colors: IWorkbenchColors = {};
        for (const [key, value] of Object.entries(merged)) {
            (colors as Record<string, number>)[key] = parseHexColor(value);
        }

        const tokenTheme: IEditorTokenTheme = {
            rules: json.tokenColors ?? [],
        };

        return new WorkbenchTheme(json.name ?? "Unnamed", json.type ?? "dark", colors, tokenTheme);
    }

    /**
     * Get an optional color by its VS Code key (e.g. `"editor.background"`).
     *
     * Returns `undefined` only for colors with no default in the registry —
     * genuinely optional overrides the consumer must handle (e.g.
     * `list.hoverForeground`, `editorGutter.background`). For chrome that must
     * always render, use {@link getRequiredColor}.
     */
    public getColor(key: keyof IWorkbenchColors): number | undefined {
        return this.colors[key];
    }

    /**
     * Get a required color by its VS Code key.
     *
     * Throws if the color is defined neither by the theme nor the default color
     * registry — a programming error meaning the key is missing from
     * {@link defaultWorkbenchColors}. This enforces the invariant that every
     * color the app relies on has a default and resolves on every theme.
     */
    public getRequiredColor(key: keyof IWorkbenchColors): number {
        const color = this.colors[key];
        if (color === undefined) {
            throw new Error(
                `Workbench color "${key}" is not defined by theme "${this.name}" ` +
                    `and has no entry in the default color registry (src/vs/platform/theme/common/colorRegistry.ts).`,
            );
        }
        return color;
    }
}
