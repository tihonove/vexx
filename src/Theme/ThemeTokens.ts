import { token } from "../vs/platform/instantiation/common/instantiation.ts";

import type { ThemeRegistry } from "./ThemeRegistry.ts";
import type { ThemeService } from "./ThemeService.ts";

export const ThemeServiceDIToken = token<ThemeService>("ThemeService");
export const ThemeRegistryDIToken = token<ThemeRegistry>("ThemeRegistry");
