import type { ContainerModule } from "../../platform/instantiation/common/instantiation.ts";
import type { IUserKeybindingRule } from "../../platform/keybinding/node/keybindingsService.ts";
import { UserKeybindingsDIToken } from "../../platform/keybinding/node/keybindingsService.ts";

export interface KeybindingsModuleContext {
    rules: readonly IUserKeybindingRule[];
}

export const keybindingsModule: ContainerModule<KeybindingsModuleContext> = (container, { rules }) => {
    container.bind(UserKeybindingsDIToken, () => rules);
};

/** Shortcut for tests: no user keybindings. */
export const keybindingsModuleDefault: ContainerModule = (container) => {
    container.bind(UserKeybindingsDIToken, () => []);
};
