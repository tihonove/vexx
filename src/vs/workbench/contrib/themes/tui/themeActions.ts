import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import type { IConfigurationService } from "../../../../platform/configuration/common/configuration.ts";
import { parseChord } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { QuickInputController } from "../../../../platform/quickinput/tui/quickInputController.ts";
import type { ThemeRegistry } from "../../../services/themes/common/themeRegistry.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";

/**
 * Open the color-theme picker (VS Code `workbench.action.selectTheme`). Default
 * chord matches VS Code (Ctrl+K Ctrl+T). The real handler is installed by
 * `AppController`; this only declares id / title / binding.
 */
export const selectThemeAction: CommandAction = {
    id: "workbench.action.selectTheme",
    title: "Preferences: Color Theme",
    keybinding: parseChord("ctrl+k ctrl+t"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

/** Human-readable base-type label shown next to a theme in the picker. */
export function themeTypeLabel(type: "dark" | "light" | "hc" | "hcLight"): string {
    switch (type) {
        case "light":
            return "light";
        case "hc":
            return "high contrast";
        case "hcLight":
            return "high contrast light";
        default:
            return "dark";
    }
}

/**
 * Color-theme picker (VS Code `workbench.action.selectTheme`). Lists every
 * registered theme, applies it live as you arrow through the list, and on
 * Enter persists the choice to `workbench.colorTheme`. Escape / dismiss
 * restores the theme that was active before the picker opened.
 */
export async function selectColorTheme(deps: {
    themeService: ThemeService;
    themeRegistry: ThemeRegistry;
    quickInput: QuickInputController;
    configuration: IConfigurationService;
}): Promise<void> {
    const originalTheme = deps.themeService.theme;
    const descriptors = deps.themeRegistry.list();

    const items = descriptors.map((d) => ({
        label: d.label,
        description: themeTypeLabel(d.type),
    }));
    const activeIndex = Math.max(
        0,
        descriptors.findIndex((d) => d.label === originalTheme.name),
    );

    const applyByLabel = (label: string): void => {
        const theme = deps.themeRegistry.resolve(label);
        /* v8 ignore start -- defensive: `label` always originates from the registry's own list()/picker items, so resolve() never returns undefined */
        if (theme) deps.themeService.setTheme(theme);
        /* v8 ignore stop */
    };

    const picked = await deps.quickInput.quickPick({
        title: "Color Theme",
        placeholder: "Select Color Theme (Up/Down Keys to Preview)",
        items,
        activeIndex,
        onDidChangeActive: (item) => {
            if (item) applyByLabel(item.label);
        },
    });

    if (picked === undefined) {
        // Cancelled — undo any live preview by restoring the original theme.
        deps.themeService.setTheme(originalTheme);
        return;
    }

    applyByLabel(picked.label);
    void deps.configuration.updateUserValue?.("workbench.colorTheme", picked.label);
}
