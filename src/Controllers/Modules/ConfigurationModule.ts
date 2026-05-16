import type { ContainerModule } from "../../Common/DiContainer.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";

export interface ConfigurationModuleContext {
    configurationService: IConfigurationService;
}

/**
 * Биндит `IConfigurationServiceDIToken` на готовый экземпляр сервиса.
 * В production-сборке это `ConfigurationService.loadConfiguration(paths)`,
 * в тестах — `NULL_CONFIGURATION_SERVICE` (см. `configurationModuleDefault`).
 */
export const configurationModule: ContainerModule<ConfigurationModuleContext> = (container, { configurationService }) => {
    container.bind(IConfigurationServiceDIToken, () => configurationService);
};

/** Shortcut с null-сервисом для тестов и demo. */
export const configurationModuleDefault: ContainerModule = (container) => {
    container.bind(IConfigurationServiceDIToken, () => NULL_CONFIGURATION_SERVICE);
};
