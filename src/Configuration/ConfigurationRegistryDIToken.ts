import { token } from "../Common/DiContainer.ts";

import type { ConfigurationRegistry } from "./ConfigurationRegistry.ts";

export const ConfigurationRegistryDIToken = token<ConfigurationRegistry>("ConfigurationRegistry");
