// Minimal RFC6455 codec. Scope: single-fragment frames (FIN=1), client→server
// masked, payloads up to 64 KiB practical. No continuation frames — inspector
// messages are small JSON. Enough for the inspector transport.

export const OPCODE_TEXT = 0x1;
export const OPCODE_CLOSE = 0x8;
export const OPCODE_PING = 0x9;
export const OPCODE_PONG = 0xa;

export interface DecodedFrame {
    opcode: number;
    payload: string;
}

/**
 * Extract every complete frame buffered so far. Returns the decoded frames and
 * the unconsumed tail (a partial frame awaiting more bytes).
 */
export function decodeFrames(buffer: Buffer): { frames: DecodedFrame[]; rest: Buffer } {
    const frames: DecodedFrame[] = [];
    let offset = 0;

    while (offset + 2 <= buffer.length) {
        const b1 = buffer[offset + 1];
        const opcode = buffer[offset] & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let pos = offset + 2;

        if (len === 126) {
            if (pos + 2 > buffer.length) break;
            len = buffer.readUInt16BE(pos);
            pos += 2;
        } else if (len === 127) {
            if (pos + 8 > buffer.length) break;
            len = Number(buffer.readBigUInt64BE(pos));
            pos += 8;
        }

        const maskLen = masked ? 4 : 0;
        if (pos + maskLen + len > buffer.length) break; // frame not fully arrived

        let payload: Buffer;
        if (masked) {
            const mask = buffer.subarray(pos, pos + 4);
            pos += 4;
            payload = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) {
                payload[i] = buffer[pos + i] ^ mask[i & 3];
            }
        } else {
            payload = buffer.subarray(pos, pos + len);
        }
        pos += len;

        frames.push({ opcode, payload: payload.toString("utf8") });
        offset = pos;
    }

    return { frames, rest: buffer.subarray(offset) };
}

/** Encode a server→client frame (unmasked, single fragment). */
export function encodeFrame(opcode: number, payload: Buffer): Buffer {
    const len = payload.length;
    let header: Buffer;
    if (len < 126) {
        header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
        header = Buffer.allocUnsafe(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.allocUnsafe(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
}

/** Encode a server→client text frame. */
export function encodeTextFrame(text: string): Buffer {
    return encodeFrame(OPCODE_TEXT, Buffer.from(text, "utf8"));
}
