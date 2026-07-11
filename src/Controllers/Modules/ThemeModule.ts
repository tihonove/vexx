import type { ContainerModule } from "../../Common/DiContainer.ts";
import { createBuiltinThemeRegistry, ThemeRegistry } from "../../Theme/ThemeRegistry.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";

export interface ThemeModuleContext {
    theme: WorkbenchTheme;
    /** Registry of selectable themes (built-in + future extension-contributed). */
    themeRegistry?: ThemeRegistry;
}

/**
 * Регистрирует `ThemeService` с переданной темой и `ThemeRegistry` с набором
 * доступных для выбора тем. Тему конструирует вызывающая сторона (production —
 * из VS Code-совместимого файла по `workbench.colorTheme`, тесты — `darkPlusTheme`
 * по умолчанию). Реестр по умолчанию — все встроенные темы.
 */
export const themeModule: ContainerModule<ThemeModuleContext> = (container, { theme, themeRegistry }) => {
    const registry = themeRegistry ?? createBuiltinThemeRegistry();
    container.bind(ThemeServiceDIToken, () => new ThemeService(theme));
    container.bind(ThemeRegistryDIToken, () => registry);
};
