import type { ITerminalBackend } from "../vs/tui/backend/terminalBackend.ts";
import type { ServiceAccessor } from "../vs/platform/instantiation/common/instantiation.ts";
import { token } from "../vs/platform/instantiation/common/instantiation.ts";
import type { IClipboard } from "../vs/platform/clipboard/common/clipboardService.ts";
import type { IFileClipboard } from "../vs/platform/clipboard/common/fileClipboard.ts";
import type { MarkerService } from "../vs/platform/markers/common/markerService.ts";
import type { ILanguageService } from "../vs/editor/common/languages/language.ts";
import type { ITokenStyleResolver } from "../vs/editor/common/languages/tokenStyleResolver.ts";
import type { TokenizationRegistry } from "../vs/editor/common/tokenizationRegistry.ts";
import type { TuiApplication } from "../vs/base/tui/tuiApplication.ts";

export const ServiceAccessorDIToken = token<ServiceAccessor>("ServiceAccessor");
export const TuiApplicationDIToken = token<TuiApplication>("TuiApplication");
export const ClipboardDIToken = token<IClipboard>("Clipboard");
export const FileClipboardDIToken = token<IFileClipboard>("FileClipboard");
export const TerminalBackendDIToken = token<ITerminalBackend>("TerminalBackend");
export const TokenizationRegistryDIToken = token<TokenizationRegistry>("TokenizationRegistry");
export const TokenStyleResolverDIToken = token<ITokenStyleResolver>("TokenStyleResolver");
export const LanguageServiceDIToken = token<ILanguageService>("LanguageService");
export const MarkerServiceDIToken = token<MarkerService>("MarkerService");
/** Absolute path of the active-profile Vexx settings.json, or null when unknown (tests/demo). */
export const SettingsResourceDIToken = token<string | null>("SettingsResource");
/** Absolute path of the active-profile Vexx keybindings.json, or null when unknown (tests/demo). */
export const KeybindingsResourceDIToken = token<string | null>("KeybindingsResource");
