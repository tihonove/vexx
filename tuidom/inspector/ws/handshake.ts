import { createHash } from "node:crypto";

// RFC6455 magic GUID appended to Sec-WebSocket-Key before hashing.
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** Compute the Sec-WebSocket-Accept value for a client's Sec-WebSocket-Key. */
export function computeAcceptKey(secWebSocketKey: string): string {
    return createHash("sha1")
        .update(secWebSocketKey + WS_GUID)
        .digest("base64");
}
