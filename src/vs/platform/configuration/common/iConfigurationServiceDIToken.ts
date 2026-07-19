import { token } from "../../instantiation/common/diContainer.ts";

import type { IConfigurationService } from "./iConfigurationService.ts";

export const IConfigurationServiceDIToken = token<IConfigurationService>("ConfigurationService");
