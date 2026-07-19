import { token } from "../../../Common/DiContainer.ts";
import type { CommandRegistry } from "../CommandRegistry.ts";
import { CommandRegistryDIToken } from "../CommandRegistry.ts";
import type { ContextKeyService } from "../ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../ContextKeyService.ts";
import type { KeybindingRegistry } from "../KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken } from "../KeybindingRegistry.ts";

import type { IQuickAccessProvider, QuickAccessItem } from "./IQuickAccessProvider.ts";

export const CommandsQuickAccessProviderDIToken = token<CommandsQuickAccessProvider>("CommandsQuickAccessProvider");

/**
 * Command palette (`>`): команды с заголовками из {@link CommandRegistry},
 * фильтр по подстроке заголовка (case-insensitive), шорткат — актуальный
 * кейбинд команды в текущем контексте.
 */
export class CommandsQuickAccessProvider implements IQuickAccessProvider {
    public static readonly PREFIX = ">";

    public static dependencies = [CommandRegistryDIToken, KeybindingRegistryDIToken, ContextKeyServiceDIToken] as const;

    public constructor(
        private readonly commands: CommandRegistry,
        private readonly keybindings: KeybindingRegistry,
        private readonly contextKeys: ContextKeyService,
    ) {}

    public getPlaceholder(): string {
        return "Show All Commands";
    }

    public getItems(query: string): QuickAccessItem[] {
        const filter = query.slice(CommandsQuickAccessProvider.PREFIX.length).trimStart();
        const all = this.commands.listCommands();
        const filterLower = filter.toLowerCase();

        const matched = filterLower === "" ? all : all.filter((cmd) => cmd.title.toLowerCase().includes(filterLower));

        return matched.map((cmd): QuickAccessItem => {
            const chord = this.keybindings.getKeybindingForCommand(cmd.id, this.contextKeys);
            return {
                label: cmd.title,
                shortcut: chord ? formatKeybinding(chord) : undefined,
                accept: () => {
                    this.commands.execute(cmd.id);
                },
            };
        });
    }
}
