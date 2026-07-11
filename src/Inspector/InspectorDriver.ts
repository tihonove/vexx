import type { GridSnapshot } from "../Rendering/GridSnapshot.ts";

/**
 * Write/capture side of the inspector — the counterpart to the read-only
 * {@link import("./InspectorCore.ts").InspectorTarget}. Present only when the app
 * runs in a drivable mode (headless capture); a normal terminal session attaches
 * the inspector without a driver and stays read-only.
 *
 * The App layer supplies the concrete adapter (over `HeadlessCaptureBackend`), so
 * the Inspector layer never imports Backend — it only depends on this port and on
 * the {@link GridSnapshot} data type.
 */
export interface InspectorDriver {
    /** Inject a key by DSL name (`"a"`, `"Enter"`, `"Ctrl+P"`). */
    sendKey(name: string): void;
    /** Inject literal text as a single bracketed paste. */
    sendText(text: string): void;
    /** Resize the virtual terminal. */
    resize(cols: number, rows: number): void;
    /**
     * Capture the current screen. Async so the adapter can first drain any
     * deferred render (the app schedules some renders on `setImmediate`).
     */
    captureFrame(): Promise<GridSnapshot>;
    /** Tear down the session and exit the process. */
    shutdown(): void;
}
