import { token } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

export const CommandRegistryDIToken = token<CommandRegistry>("CommandRegistry");

export type CommandHandler = (...args: unknown[]) => unknown;

export class CommandRegistry implements IDisposable {
    private handlers = new Map<string, CommandHandler>();

    public register(id: string, handler: CommandHandler): IDisposable {
        this.handlers.set(id, handler);
        return {
            dispose: () => {
                if (this.handlers.get(id) === handler) {
                    this.handlers.delete(id);
                }
            },
        };
    }

    public execute(id: string, ...args: unknown[]): unknown {
        const handler = this.handlers.get(id);
        if (!handler) return undefined;
        return handler(...args);
    }

    public has(id: string): boolean {
        return this.handlers.has(id);
    }

    public dispose(): void {
        this.handlers.clear();
    }
}
