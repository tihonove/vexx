// TUIDom inspector protocol — own, CDP-shaped (not CDP-compatible).
//
// Wire form mirrors Chrome DevTools Protocol in shape only: a request carries
// `{ id, method, params? }`, a reply is `{ id, result }` or `{ id, error }`.
// Methods live under the `TUIDom.*` namespace. The protocol is transport-
// agnostic — InspectorCore speaks it directly (in-process) or over WebSocket.

import type { GridSnapshot } from "../Rendering/GridSnapshot.ts";

/** Method names (namespace `TUIDom.*`). */
export const InspectorMethod = {
    getDocument: "TUIDom.getDocument",
    /** Inject a key by DSL name. Requires a driver (headless mode). */
    sendKey: "TUIDom.sendKey",
    /** Inject literal text as a paste. Requires a driver. */
    sendText: "TUIDom.sendText",
    /** Resize the virtual terminal. Requires a driver. */
    resize: "TUIDom.resize",
    /** Capture the current screen as a {@link GridSnapshot}. Requires a driver. */
    captureFrame: "TUIDom.captureFrame",
    /** Tear down the session and exit. Requires a driver. */
    shutdown: "TUIDom.shutdown",
} as const;

/** Params for `TUIDom.sendKey`. */
export interface SendKeyParams {
    name: string;
}

/** Params for `TUIDom.sendText`. */
export interface SendTextParams {
    text: string;
}

/** Params for `TUIDom.resize`. */
export interface ResizeParams {
    cols: number;
    rows: number;
}

/** Result of `TUIDom.captureFrame`. */
export interface CaptureFrameResult {
    frame: GridSnapshot;
}

/** Serialized tree node. */
export interface NodeSnapshot {
    /** Sequential id within a single snapshot (pre-order). Not stable across snapshots yet. */
    nodeId: number;
    /** Runtime class name (e.g. "BodyElement"). */
    type: string;
    id?: string;
    role?: string;
    tabIndex?: number;
    box: { x: number; y: number; width: number; height: number };
    style: { fg: number; bg: number };
    focused: boolean;
    text?: string;
    children: NodeSnapshot[];
}

/** Result of `TUIDom.getDocument`. */
export interface GetDocumentResult {
    root: NodeSnapshot | null;
}

/** Inbound request envelope. */
export interface InspectorRequest {
    id: number;
    method: string;
    params?: unknown;
}

export interface InspectorSuccessResponse {
    id: number;
    result: unknown;
}

export interface InspectorErrorResponse {
    id: number;
    error: { message: string };
}

export type InspectorResponse = InspectorSuccessResponse | InspectorErrorResponse;
