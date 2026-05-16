import { token } from "../../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../../Common/Disposable.ts";

import { ExtensionRuntime } from "./ExtensionRuntime.ts";
import type { IEditorOptionsPatch, IEditorOptionsService } from "./IEditorOptionsService.ts";
import type { IExtensionRegistration } from "./IExtensionEntry.ts";
import type { IMessageChannel } from "./IMessageChannel.ts";
import { createInProcessChannelPair } from "./InProcessChannelPair.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";

export const ExtensionHostDIToken = token<ExtensionHost>("ExtensionHost");

interface ActiveExtension {
    readonly id: string;
    readonly runtime: ExtensionRuntime;
    readonly hostChannel: IMessageChannel;
    readonly runtimeChannel: IMessageChannel;
    readonly hostRpc: RpcEndpoint;
}

/**
 * Host-сторона: владеет каналами, регистрирует request handlers поверх
 * {@link RpcEndpoint}, инстанцирует {@link ExtensionRuntime} per extension.
 *
 * В Phase 1 каждое расширение получает свой in-process channel pair; при
 * переходе на self-spawn здесь будет `child_process.fork()` + `node:Stream`
 * вместо `createInProcessChannelPair()`.
 *
 * API:
 * - `registerExtension(reg)` — создаёт пару каналов, поднимает runtime,
 *   ждёт `activate()`. Возвращает `IDisposable` для unload.
 * - `dispose()` — деактивирует все расширения, рвёт каналы.
 */
export class ExtensionHost extends Disposable {
    private readonly editorOptions: IEditorOptionsService;
    private readonly extensions = new Map<string, ActiveExtension>();
    private hostDisposed = false;

    public constructor(editorOptions: IEditorOptionsService) {
        super();
        this.editorOptions = editorOptions;
    }

    public async registerExtension(reg: IExtensionRegistration): Promise<IDisposable> {
        if (this.hostDisposed) throw new Error("ExtensionHost disposed");
        if (this.extensions.has(reg.id)) {
            throw new Error(`Extension "${reg.id}" already registered`);
        }

        const [hostChannel, runtimeChannel] = createInProcessChannelPair();
        const hostRpc = new RpcEndpoint(hostChannel);
        this.installHostHandlers(hostRpc);

        const runtime = new ExtensionRuntime(runtimeChannel, reg.entry);
        const active: ActiveExtension = { id: reg.id, runtime, hostChannel, runtimeChannel, hostRpc };
        this.extensions.set(reg.id, active);

        try {
            await runtime.activate();
        } catch (error) {
            this.extensions.delete(reg.id);
            await this.teardownExtension(active);
            throw error;
        }

        return {
            dispose: (): void => {
                if (!this.extensions.has(reg.id)) return;
                void this.unregisterExtension(reg.id);
            },
        };
    }

    public async unregisterExtension(id: string): Promise<void> {
        const active = this.extensions.get(id);
        if (active === undefined) return;
        this.extensions.delete(id);
        await this.teardownExtension(active);
    }

    public hasExtension(id: string): boolean {
        return this.extensions.has(id);
    }

    public get extensionCount(): number {
        return this.extensions.size;
    }

    public override dispose(): void {
        if (this.hostDisposed) return;
        this.hostDisposed = true;
        const all = [...this.extensions.values()];
        this.extensions.clear();
        for (const active of all) {
            void this.teardownExtension(active);
        }
        super.dispose();
    }

    private async teardownExtension(active: ActiveExtension): Promise<void> {
        try {
            await active.runtime.deactivate();
        } finally {
            active.runtime.dispose();
            active.hostRpc.dispose();
            active.hostChannel.dispose();
            active.runtimeChannel.dispose();
        }
    }

    private installHostHandlers(rpc: RpcEndpoint): void {
        rpc.handleRequest("editor.setOptions", (params): unknown => {
            const patch = sanitizeOptionsPatch(params);
            this.editorOptions.setActiveEditorOptions(patch);
            return null;
        });
        rpc.handleRequest("editor.getOptions", (): unknown => {
            return this.editorOptions.getActiveEditorOptions();
        });
    }
}

function sanitizeOptionsPatch(raw: unknown): IEditorOptionsPatch {
    if (typeof raw !== "object" || raw === null) return {};
    const obj = raw as { tabSize?: unknown; insertSpaces?: unknown };
    const patch: { tabSize?: number; insertSpaces?: boolean } = {};
    if (typeof obj.tabSize === "number" && Number.isFinite(obj.tabSize) && obj.tabSize > 0) {
        patch.tabSize = Math.floor(obj.tabSize);
    }
    if (typeof obj.insertSpaces === "boolean") {
        patch.insertSpaces = obj.insertSpaces;
    }
    return patch;
}
