// TUIDom inspector protocol — own, CDP-shaped (not CDP-compatible).
//
// Wire form mirrors Chrome DevTools Protocol in shape only: a request carries
// `{ id, method, params? }`, a reply is `{ id, result }` or `{ id, error }`.
// Methods live under the `TUIDom.*` namespace. The protocol is transport-
// agnostic — InspectorCore speaks it directly (in-process) or over WebSocket.

/** Method names (namespace `TUIDom.*`). */
export const InspectorMethod = {
    getDocument: "TUIDom.getDocument",
} as const;

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
