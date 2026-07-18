import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import type { ThemeRegistry } from "../../Theme/ThemeRegistry.ts";
import type { ThemeService } from "../../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../../Theme/ThemeTokens.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const ThemeConfigContributionDIToken = token<ThemeConfigContribution>("ThemeConfigContribution");

/**
 * Live-reload цветовой темы: смена `workbench.colorTheme` в settings.json
 * перекрашивает UI без рестарта. Подписка на конфиг → резолв темы по имени →
 * `ThemeService.setTheme` (дёрнет `onThemeChange` у всех подписчиков).
 */
export class ThemeConfigContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [IConfigurationServiceDIToken, ThemeServiceDIToken, ThemeRegistryDIToken] as const;

    public constructor(
        private readonly configurationService: IConfigurationService,
        private readonly themeService: ThemeService,
        private readonly themeRegistry: ThemeRegistry,
    ) {
        super();
        this.register(
            this.configurationService.onDidChangeConfiguration((event) => {
                if (!event.affectsConfiguration("workbench.colorTheme")) return;
                this.applyColorThemeFromConfiguration();
            }),
        );
    }

    /**
     * Резолвит тему по имени из `workbench.colorTheme` и применяет её. Guard по
     * имени: если тема уже активна (напр. правку внёс сам theme-picker через
     * `updateUserValue`), лишнего перекраса не делаем. Неизвестное имя игнорируем.
     */
    private applyColorThemeFromConfiguration(): void {
        const name = this.configurationService.get<string>("workbench.colorTheme");
        if (name === undefined) return;
        if (name === this.themeService.theme.name) return;
        const theme = this.themeRegistry.resolve(name);
        if (theme) this.themeService.setTheme(theme);
    }
}
