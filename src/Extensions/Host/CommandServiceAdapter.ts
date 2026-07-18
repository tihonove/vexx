import type { IDisposable } from "../../Common/Disposable.ts";
import type { CommandRegistry } from "../../Workbench/Services/CommandRegistry.ts";

import type { ICommandService } from "./ICommandService.ts";

/**
 * Реализация {@link ICommandService} поверх {@link CommandRegistry}. Живёт в
 * слое Extensions (Controllers ничего не должен знать про host).
 */
export class CommandServiceAdapter implements ICommandService {
    private readonly registry: CommandRegistry;

    public constructor(registry: CommandRegistry) {
        this.registry = registry;
    }

    public execute(id: string, args: readonly unknown[]): unknown {
        if (!this.registry.has(id)) {
            throw new Error(`command "${id}" not found`);
        }
        return this.registry.execute(id, ...args);
    }

    public registerProxy(id: string, invoke: (args: readonly unknown[]) => unknown, title?: string): IDisposable {
        return this.registry.register(id, (...args) => invoke(args), title);
    }
}
