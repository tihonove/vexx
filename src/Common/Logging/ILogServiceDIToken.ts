import { token } from "../DiContainer.ts";

import type { ILogService } from "./ILogService.ts";

export const ILogServiceDIToken = token<ILogService>("ILogService");
