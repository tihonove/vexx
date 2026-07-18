import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { ButtonElement } from "../TUIDom/Widgets/ButtonElement.ts";

/**
 * Красит {@link ButtonElement} из активной темы (ключи VS Code `button.*`).
 * TUIDom не зависит от слоя Theme (docs/ARCHITECTURE.md): контрол несёт только
 * plain color-props, а маппинг темы живёт здесь — тот же шов, что и
 * `applyScrollBarTheme`. `button.*` гарантированы реестром дефолтов, инлайн
 * fallback не нужен.
 */
export function applyButtonTheme(button: ButtonElement, theme: WorkbenchTheme): void {
    button.focusedBg = theme.getRequiredColor("button.background");
    button.focusedFg = theme.getRequiredColor("button.foreground");
    button.focusedHoverBg = theme.getRequiredColor("button.hoverBackground");
    button.normalBg = theme.getRequiredColor("button.secondaryBackground");
    button.normalFg = theme.getRequiredColor("button.secondaryForeground");
    button.normalHoverBg = theme.getRequiredColor("button.secondaryHoverBackground");
    button.markDirty();
}
