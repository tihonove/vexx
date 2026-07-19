import type { TuiApplication } from "../dom/tuiApplication.ts";

import { InspectorCore, type InspectorTarget } from "./InspectorCore.ts";
import type { InspectorDriver } from "./InspectorDriver.ts";
import { InspectorServer, type InspectorServerOptions } from "./InspectorServer.ts";

export interface AttachedInspector {
    core: InspectorCore;
    server: InspectorServer;
    port: number;
    dispose(): void;
}

/**
 * Attach an inspector to a running `TuiApplication` over WebSocket. Reads the
 * app read-only (root/focus). When a {@link InspectorDriver} is supplied (headless
 * mode) the inspector also exposes input-injection and frame-capture methods;
 * without it the inspector stays read-only. For in-process use (e.g. a
 * split-screen inspector widget) build an `InspectorCore` directly instead.
 */
export async function attachInspector(
    app: TuiApplication,
    options: InspectorServerOptions = {},
    driver?: InspectorDriver,
): Promise<AttachedInspector> {
    const target: InspectorTarget = {
        getRoot: () => app.root,
        getFocused: () => app.focusManager?.activeElement ?? null,
    };
    const core = new InspectorCore(target, driver);
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
