import type { ContainerModule } from "../../vs/platform/instantiation/common/instantiation.ts";
import { CommandRegistry, CommandRegistryDIToken } from "../../vs/platform/commands/common/commands.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "../../vs/platform/contextkey/common/contextKeyService.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "../../vs/platform/keybinding/common/keybindingsRegistry.ts";
import { ModifierReleaseArmory, ModifierReleaseArmoryDIToken } from "../../vs/platform/keybinding/common/modifierReleaseArmory.ts";

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
