import type { ContainerModule } from "../../Common/DiContainer.ts";
import { CommandRegistry, CommandRegistryDIToken } from "../CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "../ContextKeyService.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "../KeybindingRegistry.ts";

/**
 * Команды, кейбиндинги и when-context. Без внешнего конфига —
 * все три реестра конструируются с дефолтным состоянием.
 */
export const commandsModule: ContainerModule = (container) => {
    container.bind(CommandRegistryDIToken, () => new CommandRegistry());
    container.bind(KeybindingRegistryDIToken, () => new KeybindingRegistry());
    container.bind(ContextKeyServiceDIToken, () => new ContextKeyService());
};
