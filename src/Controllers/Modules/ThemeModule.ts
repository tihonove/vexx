import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";

export interface ThemeModuleContext {
    theme: WorkbenchTheme;
}

/**
 * Регистрирует `ThemeService` с переданной темой. Тему конструирует
 * вызывающая сторона (production — из VS Code-совместимого файла,
 * тесты — `darkPlusTheme` по умолчанию).
 */
export const themeModule: ContainerModule<ThemeModuleContext> = (container, { theme }) => {
    container.bind(ThemeServiceDIToken, () => new ThemeService(theme));
};
