import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { IAboutDialogStyles } from "../../TUIDom/Widgets/AboutDialogElement.tsx";
import type { IButtonStyles } from "../../TUIDom/Widgets/ButtonElement.ts";
import type { IConfirmDialogStyles } from "../../TUIDom/Widgets/ConfirmDialogElement.tsx";
import type { IConfirmSaveDialogStyles } from "../../TUIDom/Widgets/ConfirmSaveDialogElement.tsx";
import type { IFindWidgetStyles } from "../../TUIDom/Widgets/FindWidgetElement.ts";
import type { IMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";
import { unthemedMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";

/**
 * Мост тема → стили контролов TUIDom: единственное место, где ключи темы
 * (`button.*`, `menu.*`, …) резолвятся в packed-цвета styles-интерфейсов
 * виджетов. Сами виджеты про темы не знают — контроллеры зовут эти функции
 * и передают результат в `setStyles(...)`.
 */

/**
 * Кнопки диалогов/виджетов: фокусированная кнопка — «primary» (`button.*`),
 * нефокусированная — «secondary» (`button.secondary*`). `button.*` токены
 * гарантированы реестром дефолтов, инлайн-фоллбэки не нужны.
 */
export function getDialogButtonStyles(theme: WorkbenchTheme): IButtonStyles {
    return {
        fg: theme.getRequiredColor("button.secondaryForeground"),
        bg: theme.getRequiredColor("button.secondaryBackground"),
        hoverBg: theme.getRequiredColor("button.secondaryHoverBackground"),
        focusedFg: theme.getRequiredColor("button.foreground"),
        focusedBg: theme.getRequiredColor("button.background"),
        focusedHoverBg: theme.getRequiredColor("button.hoverBackground"),
    };
}

export function getConfirmDialogStyles(theme: WorkbenchTheme): IConfirmDialogStyles {
    return { button: getDialogButtonStyles(theme) };
}

export function getConfirmSaveDialogStyles(theme: WorkbenchTheme): IConfirmSaveDialogStyles {
    return { button: getDialogButtonStyles(theme) };
}

export function getAboutDialogStyles(theme: WorkbenchTheme): IAboutDialogStyles {
    return { button: getDialogButtonStyles(theme) };
}

export function getFindWidgetStyles(theme: WorkbenchTheme): IFindWidgetStyles {
    return { button: getDialogButtonStyles(theme) };
}

/**
 * Цвета меню из ключей VS Code `menu.*`. Они гарантированы реестром дефолтов
 * (см. {@link defaultWorkbenchColors}), а `shortcutFg` не имеет темизируемого
 * ключа VS Code и берётся из {@link unthemedMenuStyles} (baseline меню без темы).
 */
export function getMenuStyles(theme: WorkbenchTheme): IMenuStyles {
    return {
        fg: theme.getRequiredColor("menu.foreground"),
        bg: theme.getRequiredColor("menu.background"),
        highlightFg: theme.getRequiredColor("menu.selectionForeground"),
        highlightBg: theme.getRequiredColor("menu.selectionBackground"),
        shortcutFg: unthemedMenuStyles.shortcutFg,
        borderFg: theme.getRequiredColor("menu.border"),
        separatorFg: theme.getRequiredColor("menu.separatorBackground"),
    };
}
