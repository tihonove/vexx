import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Socket } from "node:net";

import type { InspectorCore } from "./InspectorCore.ts";
import type { InspectorRequest } from "./protocol.ts";
import {
    decodeFrames,
    encodeFrame,
    encodeTextFrame,
    OPCODE_CLOSE,
    OPCODE_PING,
    OPCODE_PONG,
    OPCODE_TEXT,
} from "./ws/frame.ts";
import { computeAcceptKey } from "./ws/handshake.ts";

export interface InspectorServerOptions {
    host?: string;
    port?: number;
}

/**
 * WebSocket transport for the inspector: a hand-written RFC6455 server over
 * node:http (zero runtime deps). Routes each inbound JSON message to
 * `InspectorCore.dispatch` and writes back the response frame.
 */
export class InspectorServer {
    private readonly core: InspectorCore;
    private readonly httpServer: Server;
    private readonly sockets = new Set<Socket>();

    public constructor(core: InspectorCore) {
        this.core = core;
        this.httpServer = createServer((_req, res) => {
            res.writeHead(426); // Upgrade Required — this endpoint is WebSocket only
            res.end("WebSocket only");
        });
        this.httpServer.on("upgrade", (req, socket) => {
            this.handleUpgrade(req, socket as Socket);
        });
    }

    public listen(options: InspectorServerOptions = {}): Promise<{ port: number }> {
        const host = options.host ?? "127.0.0.1";
        const port = options.port ?? 0;
        return new Promise((resolve) => {
            this.httpServer.listen(port, host, () => {
                const addr = this.httpServer.address();
                const boundPort = typeof addr === "object" && addr !== null ? addr.port : port;
                resolve({ port: boundPort });
            });
        });
    }

    public dispose(): void {
        for (const socket of this.sockets) socket.destroy();
        this.sockets.clear();
        this.httpServer.close();
    }

    private handleUpgrade(req: IncomingMessage, socket: Socket): void {
        const key = req.headers["sec-websocket-key"];
        if (typeof key !== "string") {
            socket.destroy();
            return;
        }
        socket.write(
            "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                `Sec-WebSocket-Accept: ${computeAcceptKey(key)}\r\n\r\n`,
        );
        this.sockets.add(socket);

        let buffer: Buffer = Buffer.alloc(0);
        socket.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);
            const { frames, rest } = decodeFrames(buffer);
            buffer = rest;
            for (const frame of frames) {
                this.handleFrame(socket, frame.opcode, frame.payload);
            }
        });
        socket.on("close", () => this.sockets.delete(socket));
        socket.on("error", () => this.sockets.delete(socket));
    }

    private handleFrame(socket: Socket, opcode: number, payload: string): void {
        if (opcode === OPCODE_CLOSE) {
            socket.end();
            return;
        }
        if (opcode === OPCODE_PING) {
            socket.write(encodeFrame(OPCODE_PONG, Buffer.from(payload, "utf8")));
            return;
        }
        if (opcode !== OPCODE_TEXT) return;

        let request: InspectorRequest;
        try {
            request = JSON.parse(payload) as InspectorRequest;
        } catch {
            return; // ignore non-JSON frames
        }
        const response = this.core.dispatch(request);
        socket.write(encodeTextFrame(JSON.stringify(response)));
    }
}
