import type { ContainerModule } from "../../Common/DiContainer.ts";
import { token } from "../../Common/DiContainer.ts";
import type { IUserKeybindingRule } from "../../Configuration/KeybindingsService.ts";

/** User keybinding rules loaded from `keybindings.json` (empty when none / in tests). */
export const UserKeybindingsDIToken = token<readonly IUserKeybindingRule[]>("UserKeybindings");

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
