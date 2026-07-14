import { token } from "../../instantiation/common/instantiation.ts";

import type { IConfigurationService } from "./configuration.ts";

export const IConfigurationServiceDIToken = token<IConfigurationService>("ConfigurationService");
