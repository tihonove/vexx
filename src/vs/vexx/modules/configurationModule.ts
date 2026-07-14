import type { ContainerModule } from "../../platform/instantiation/common/instantiation.ts";
import type { IConfigurationService } from "../../platform/configuration/common/configuration.ts";
import { IConfigurationServiceDIToken } from "../../platform/configuration/common/configurationDIToken.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../platform/configuration/common/nullConfigurationService.ts";

export interface ConfigurationModuleContext {
    configurationService: IConfigurationService;
}

/**
 * Биндит `IConfigurationServiceDIToken` на готовый экземпляр сервиса.
 * В production-сборке это `ConfigurationService.loadConfiguration(paths)`,
 * в тестах — `NULL_CONFIGURATION_SERVICE` (см. `configurationModuleDefault`).
 */
export const configurationModule: ContainerModule<ConfigurationModuleContext> = (
    container,
    { configurationService },
) => {
    container.bind(IConfigurationServiceDIToken, () => configurationService);
};

/** Shortcut с null-сервисом для тестов и demo. */
export const configurationModuleDefault: ContainerModule = (container) => {
    container.bind(IConfigurationServiceDIToken, () => NULL_CONFIGURATION_SERVICE);
};
