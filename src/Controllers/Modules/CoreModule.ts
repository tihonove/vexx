import type { ContainerModule, ServiceAccessor } from "../../vs/platform/instantiation/common/instantiation.ts";
import type { TuiApplication } from "../../vs/base/tui/tuiApplication.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "../CoreTokens.ts";

export interface CoreModuleContext {
    app: TuiApplication;
}

/**
 * Регистрирует базовые сервисы:
 * - `ServiceAccessorDIToken` — сам контейнер (для late-resolve в Actions);
 * - `TuiApplicationDIToken` — переданный извне инстанс приложения.
 *
 * `app` приходит снаружи, потому что его лайфтайм управляется до DI
 * (в production — рядом с backend; в тестах — TestApp создаётся уже после
 * получения view контроллера, поэтому используется `coreModuleLate`).
 */
export const coreModule: ContainerModule<CoreModuleContext> = (container, { app }) => {
    container.bind(ServiceAccessorDIToken, (): ServiceAccessor => container);
    container.bind(TuiApplicationDIToken, () => app);
};

/**
 * Вариант для тестов: регистрирует только `ServiceAccessor`. `TuiApplication`
 * биндится позже, после создания `TestApp` от уже смонтированной view.
 */
export const coreModuleLate: ContainerModule = (container) => {
    container.bind(ServiceAccessorDIToken, (): ServiceAccessor => container);
};
