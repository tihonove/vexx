import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { DEFAULT_MENU_COLORS, type MenuColors } from "../TUIDom/Widgets/PopupMenuItemElement.tsx";

/**
 * Строит палитру меню из активной темы (ключи VS Code `menu.*`). `menu.*` цвета
 * гарантированы реестром дефолтов (см. {@link defaultWorkbenchColors}), а
 * `shortcutFg` не имеет темизируемого ключа VS Code и берётся из
 * {@link DEFAULT_MENU_COLORS} (baseline для меню без темы).
 */
export function menuColorsFromTheme(theme: WorkbenchTheme): MenuColors {
    return {
        fg: theme.getRequiredColor("menu.foreground"),
        bg: theme.getRequiredColor("menu.background"),
        highlightFg: theme.getRequiredColor("menu.selectionForeground"),
        highlightBg: theme.getRequiredColor("menu.selectionBackground"),
        shortcutFg: DEFAULT_MENU_COLORS.shortcutFg,
        borderFg: theme.getRequiredColor("menu.border"),
        separatorFg: theme.getRequiredColor("menu.separatorBackground"),
    };
}
