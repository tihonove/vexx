import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ConfigurationRegistry } from "../../Configuration/ConfigurationRegistry.ts";
import { ConfigurationRegistryDIToken } from "../../Configuration/ConfigurationRegistryDIToken.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { CONFIGURATION_CONTRIBUTIONS } from "../Configuration/configurationContributions.ts";

export interface ConfigurationModuleContext {
    configurationService: IConfigurationService;
    /** Реестр схем настроек — тот же, из которого собран defaults-слой сервиса. */
    configurationRegistry: ConfigurationRegistry;
}

/**
 * Биндит `IConfigurationServiceDIToken` на готовый экземпляр сервиса и
 * `ConfigurationRegistryDIToken` на реестр схем настроек. В production-сборке
 * это `loadConfiguration(paths, …, registry)` из `main.ts`, в тестах —
 * `NULL_CONFIGURATION_SERVICE` (см. `configurationModuleDefault`).
 */
export const configurationModule: ContainerModule<ConfigurationModuleContext> = (
    container,
    { configurationService, configurationRegistry },
) => {
    container.bind(IConfigurationServiceDIToken, () => configurationService);
    container.bind(ConfigurationRegistryDIToken, () => configurationRegistry);
};

/**
 * Shortcut для тестов и demo: null-сервис настроек, но реестр — настоящий
 * (из `CONFIGURATION_CONTRIBUTIONS`), чтобы валидация settings.json знала
 * реальные ключи.
 */
export const configurationModuleDefault: ContainerModule = (container) => {
    container.bind(IConfigurationServiceDIToken, () => NULL_CONFIGURATION_SERVICE);
    container.bind(ConfigurationRegistryDIToken, () => new ConfigurationRegistry(CONFIGURATION_CONTRIBUTIONS));
};
