import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import type { TuiApplication } from "../TUIDom/TuiApplication.ts";

export const ServiceAccessorDIToken = token<ServiceAccessor>("ServiceAccessor");
export const TuiApplicationDIToken = token<TuiApplication>("TuiApplication");
