import { token } from "../Common/DiContainer.ts";

import type { IConfigurationService } from "./IConfigurationService.ts";

export const IConfigurationServiceDIToken = token<IConfigurationService>("ConfigurationService");
