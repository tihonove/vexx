import { CommandsQuickAccessProvider, CommandsQuickAccessProviderDIToken } from "./CommandsQuickAccessProvider.ts";
import { FilesQuickAccessProvider, FilesQuickAccessProviderDIToken } from "./FilesQuickAccessProvider.ts";
import { GotoLineQuickAccessProvider, GotoLineQuickAccessProviderDIToken } from "./GotoLineQuickAccessProvider.ts";
import type { IQuickAccessProviderDescriptor } from "./QuickAccessRegistry.ts";

/**
 * Явный список quick-access-провайдеров — наш аналог vscode-овского
 * `Registry.as(Extensions.Quickaccess).registerQuickAccessProvider(...)`,
 * без import-side-effects. Порядок записей не важен: реестр выбирает по
 * самому длинному подошедшему префиксу.
 */
export const QUICK_ACCESS_PROVIDERS: readonly IQuickAccessProviderDescriptor[] = [
    { prefix: FilesQuickAccessProvider.PREFIX, provider: FilesQuickAccessProviderDIToken },
    { prefix: CommandsQuickAccessProvider.PREFIX, provider: CommandsQuickAccessProviderDIToken },
    { prefix: GotoLineQuickAccessProvider.PREFIX, provider: GotoLineQuickAccessProviderDIToken },
];
