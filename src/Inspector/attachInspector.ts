import type { TuiApplication } from "../TUIDom/TuiApplication.ts";

import { InspectorCore, type InspectorTarget } from "./InspectorCore.ts";
import { InspectorServer, type InspectorServerOptions } from "./InspectorServer.ts";

export interface AttachedInspector {
    core: InspectorCore;
    server: InspectorServer;
    port: number;
    dispose(): void;
}

/**
 * Attach an inspector to a running `TuiApplication` over WebSocket. Reads the
 * app read-only (root/focus) — does not modify it. For in-process use (e.g. a
 * split-screen inspector widget) build an `InspectorCore` directly instead.
 */
export async function attachInspector(
    app: TuiApplication,
    options: InspectorServerOptions = {},
): Promise<AttachedInspector> {
    const target: InspectorTarget = {
        getRoot: () => app.root,
        getFocused: () => app.focusManager?.activeElement ?? null,
    };
    const core = new InspectorCore(target);
    const server = new InspectorServer(core);
    const { port } = await server.listen(options);
    return {
        core,
        server,
        port,
        dispose: () => {
            server.dispose();
        },
    };
}
