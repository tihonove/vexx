import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import type { IClipboard } from "../Common/IClipboard.ts";
import type { ITokenStyleResolver } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import type { TuiApplication } from "../TUIDom/TuiApplication.ts";

export const ServiceAccessorDIToken = token<ServiceAccessor>("ServiceAccessor");
export const TuiApplicationDIToken = token<TuiApplication>("TuiApplication");
export const ClipboardDIToken = token<IClipboard>("Clipboard");
export const TokenizationRegistryDIToken = token<TokenizationRegistry>("TokenizationRegistry");
export const TokenStyleResolverDIToken = token<ITokenStyleResolver>("TokenStyleResolver");
