import { token } from "../../../../platform/instantiation/common/diContainer.ts";

import type { ThemeRegistry } from "./themeRegistry.ts";
import type { ThemeService } from "./themeService.ts";

export const ThemeServiceDIToken = token<ThemeService>("ThemeService");
export const ThemeRegistryDIToken = token<ThemeRegistry>("ThemeRegistry");
