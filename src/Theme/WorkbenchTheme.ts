import { parseHexColor } from "./ColorUtils.ts";
import type { IEditorTokenTheme } from "./IEditorTokenTheme.ts";
import type { IThemeFile } from "./IThemeFile.ts";
import type { IWorkbenchColors } from "./IWorkbenchColors.ts";

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
     * All hex color strings are converted to packed 24-bit RGB integers.
     */
    public static fromThemeFile(json: IThemeFile): WorkbenchTheme {
        const colors: IWorkbenchColors = {};
        for (const [key, value] of Object.entries(json.colors)) {
            (colors as Record<string, number>)[key] = parseHexColor(value);
        }

        const tokenTheme: IEditorTokenTheme = {
            rules: json.tokenColors ?? [],
        };

        return new WorkbenchTheme(json.name ?? "Unnamed", json.type ?? "dark", colors, tokenTheme);
    }

    /**
     * Get a color by its VS Code key (e.g. `"editor.background"`).
     * Returns `undefined` if the color is not defined in the theme.
     */
    public getColor(key: keyof IWorkbenchColors): number | undefined {
        return this.colors[key];
    }

    /**
     * Get a color by its VS Code key, falling back to a default value.
     */
    public getColorOrDefault(key: keyof IWorkbenchColors, defaultValue: number): number {
        return this.colors[key] ?? defaultValue;
    }
}
