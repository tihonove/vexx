import { token } from "../../instantiation/common/diContainer.ts";

import type { ConfigurationRegistry } from "./configurationRegistry.ts";

export const ConfigurationRegistryDIToken = token<ConfigurationRegistry>("ConfigurationRegistry");
