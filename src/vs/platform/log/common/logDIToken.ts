import { token } from "../../instantiation/common/instantiation.ts";

import type { ILogService } from "./log.ts";

export const ILogServiceDIToken = token<ILogService>("ILogService");
