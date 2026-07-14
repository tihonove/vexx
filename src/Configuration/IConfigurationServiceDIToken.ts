import { token } from "../vs/platform/instantiation/common/instantiation.ts";

import type { IConfigurationService } from "./IConfigurationService.ts";

export const IConfigurationServiceDIToken = token<IConfigurationService>("ConfigurationService");
