import { token } from "../../instantiation/common/diContainer.ts";

import type { ILogService } from "./iLogService.ts";

export const ILogServiceDIToken = token<ILogService>("ILogService");
