import type { IClipboard } from "./IClipboard.ts";

/**
 * Clipboard implementation that writes to the system clipboard via OSC 52
 * escape sequence, and optionally reads from it via OSC 52 query/response.
 *
 * Write path:
 *   OSC 52 format: \x1b]52;c;<base64-encoded-text>\x07
 *
 * Read path (when subscribeFn is provided):
 *   1. Send OSC 52 query: \x1b]52;c;?\x07
 *   2. Wait for terminal response (same OSC 52 format with actual data)
 *   3. Decode base64 → UTF-8 and return the text
 *   4. If no response within 200ms, fall back to the internal write buffer
 *
 * Without subscribeFn, readText() returns the internal write buffer immediately
 * (populated on each writeText call).
 *
 * See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
 */

const READ_TIMEOUT_MS = 5000;

export class OscClipboard implements IClipboard {
    private buffer = "";
    private readonly writeFn: (seq: string) => void;
    private readonly canQuery: boolean;
    private pendingRead: { resolve: (text: string) => void; timer: ReturnType<typeof setTimeout> } | null = null;

    public constructor(
        writeFn: (seq: string) => void,
        subscribeFn?: (callback: (code: number, data: string) => void) => void,
    ) {
        this.writeFn = writeFn;
        this.canQuery = subscribeFn != null;
        if (subscribeFn) {
            subscribeFn((code, data) => {
                if (code !== 52 || !this.pendingRead) return;
                // data format: "c;<base64>" — skip the selection param prefix
                const semicolonIdx = data.indexOf(";");
                const base64 = semicolonIdx >= 0 ? data.substring(semicolonIdx + 1) : data;
                // Ignore the query echo "?" that some terminals reflect back
                if (base64 === "?") return;
                const text = Buffer.from(base64, "base64").toString("utf8");
                this.buffer = text;
                clearTimeout(this.pendingRead.timer);
                this.pendingRead.resolve(text);
                this.pendingRead = null;
            });
        }
    }

    public writeText(text: string): Promise<void> {
        this.buffer = text;
        const encoded = Buffer.from(text, "utf8").toString("base64");
        this.writeFn(`\x1b]52;c;${encoded}\x07`);
        return Promise.resolve();
    }

    public readText(): Promise<string> {
        if (!this.canQuery) {
            return Promise.resolve(this.buffer);
        }

        if (this.pendingRead) {
            // Cancel previous pending read before issuing a new one
            clearTimeout(this.pendingRead.timer);
            this.pendingRead.resolve(this.buffer);
            this.pendingRead = null;
        }

        return new Promise<string>(resolve => {
            const timer = setTimeout(() => {
                if (this.pendingRead?.resolve === resolve) {
                    this.pendingRead = null;
                }
                resolve(this.buffer);
            }, READ_TIMEOUT_MS);

            this.pendingRead = { resolve, timer };
            this.writeFn(`\x1b]52;c;?\x07`);
        });
    }
}
