import type { ContainerModule } from "../../Common/DiContainer.ts";
import { CommandRegistry, CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "../Services/ContextKeyService.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "../Services/KeybindingRegistry.ts";
import { ModifierReleaseArmory, ModifierReleaseArmoryDIToken } from "../Services/ModifierReleaseArmory.ts";

/**
 * Команды, кейбиндинги и when-context. Без внешнего конфига —
 * все три реестра конструируются с дефолтным состоянием.
 */
export const commandsModule: ContainerModule = (container) => {
    container.bind(CommandRegistryDIToken, () => new CommandRegistry());
    container.bind(KeybindingRegistryDIToken, () => new KeybindingRegistry());
    container.bind(ContextKeyServiceDIToken, () => new ContextKeyService());
    container.bind(ModifierReleaseArmoryDIToken, () => new ModifierReleaseArmory());
};
