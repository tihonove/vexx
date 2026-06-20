import * as net from "node:net";
import { fileURLToPath } from "node:url";

import * as pty from "node-pty";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import type { GetDocumentResult, InspectorResponse, InspectorSuccessResponse } from "../src/Inspector/protocol.ts";

const DEMO_PATH = fileURLToPath(new URL("../src/demos/tuidom/inspectedHost.ts", import.meta.url));

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once("error", reject);
        srv.listen(0, "127.0.0.1", () => {
            const addr = srv.address();
            const port = typeof addr === "object" && addr !== null ? addr.port : 0;
            srv.close(() => resolve(port));
        });
    });
}

function connectWithRetry(url: string, timeoutMs: number): Promise<WebSocket> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const attempt = (): void => {
            const ws = new WebSocket(url);
            ws.once("open", () => resolve(ws));
            ws.once("error", () => {
                if (Date.now() > deadline) reject(new Error(`ws connect to ${url} timed out`));
                else setTimeout(attempt, 100);
            });
        };
        attempt();
    });
}

function filterEnv(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) out[key] = value;
    }
    out.TERM = "xterm-256color";
    delete out.TMUX;
    return out;
}

describe("inspector e2e smoke (real process + WebSocket)", () => {
    let term: pty.IPty | undefined;

    afterEach(() => {
        try {
            term?.kill();
        } catch {
            // already gone
        }
        term = undefined;
    });

    it("serves TUIDom.getDocument from a spawned demo app", async () => {
        const port = await freePort();
        term = pty.spawn(process.execPath, ["--import", "tsx/esm", DEMO_PATH, String(port)], {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            env: filterEnv(),
        });

        const ws = await connectWithRetry(`ws://127.0.0.1:${String(port)}`, 20_000);
        const response = await new Promise<InspectorResponse>((resolve, reject) => {
            ws.once("message", (data: WebSocket.RawData) => resolve(JSON.parse(data.toString()) as InspectorResponse));
            ws.once("error", reject);
            ws.send(JSON.stringify({ id: 1, method: "TUIDom.getDocument" }));
        });
        ws.close();

        expect(response.id).toBe(1);
        const result = (response as InspectorSuccessResponse).result as GetDocumentResult;
        expect(result.root?.type).toBe("BodyElement");
        // the demo's box has id "main" — confirm we serialized the real tree
        const json = JSON.stringify(result.root);
        expect(json).toContain('"id":"main"');
    });
});
