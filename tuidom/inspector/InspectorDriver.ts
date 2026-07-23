import type { GridSnapshot } from "../rendering/gridSnapshot.ts";

import type { SendMouseParams, WaitForIdleParams, WaitForIdleResult } from "./protocol.ts";

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
    /** Inject a mouse event at 0-based screen coordinates (see {@link SendMouseParams}). */
    sendMouse(params: SendMouseParams): void;
    /** Resize the virtual terminal. */
    resize(cols: number, rows: number): void;
    /**
     * Capture the current screen. Async so the adapter can first drain any
     * deferred render (the app schedules some renders on `setImmediate`).
     */
    captureFrame(): Promise<GridSnapshot>;
    /**
     * Wait until the app stops repainting (frame counter stable + no scheduled
     * render). Lets a client settle after injecting input without guessing a
     * `sleep`. Resolves `idle: false` on timeout rather than rejecting.
     */
    waitForIdle(params: WaitForIdleParams): Promise<WaitForIdleResult>;
    /** Tear down the session and exit the process. */
    shutdown(): void;
}
