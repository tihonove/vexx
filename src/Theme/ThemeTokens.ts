import { token } from "../Common/DiContainer.ts";

import type { ThemeService } from "./ThemeService.ts";

export const ThemeServiceDIToken = token<ThemeService>("ThemeService");
