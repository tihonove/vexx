import type { ITerminalBackend } from "../../../Backend/ITerminalBackend.ts";
import type { ContainerModule } from "../../../Common/DiContainer.ts";
import { TerminalBackendDIToken } from "../CoreTokens.ts";

import { TerminalEnvironmentService, TerminalEnvironmentServiceDIToken } from "./TerminalEnvironmentService.ts";

export interface TerminalEnvironmentModuleContext {
    backend: ITerminalBackend;
}

/**
 * Binds the terminal backend (so the env service can probe it) and the
 * TerminalEnvironmentService itself.
 */
export const terminalEnvironmentModule: ContainerModule<TerminalEnvironmentModuleContext> = (
    container,
    { backend },
) => {
    container.bind(TerminalBackendDIToken, () => backend);
    container.bind(TerminalEnvironmentServiceDIToken, TerminalEnvironmentService);
};
