import type { IClipboard } from "./IClipboard.ts";

/**
 * Clipboard implementation that writes to the system clipboard via OSC 52
 * escape sequence. Paste reads from an internal buffer (populated on write).
 *
 * OSC 52 format: \x1b]52;c;<base64-encoded-text>\x07
 *
 * The terminal (or TMUX passthrough) relays the sequence to the host OS
 * clipboard manager. Reading the system clipboard via OSC 52 requires a
 * terminal response and is not implemented here — paste uses the in-process
 * buffer instead.
 *
 * See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
 */
export class OscClipboard implements IClipboard {
    private buffer = "";
    private readonly writeFn: (seq: string) => void;

    public constructor(writeFn: (seq: string) => void) {
        this.writeFn = writeFn;
    }

    public writeText(text: string): Promise<void> {
        this.buffer = text;
        const encoded = Buffer.from(text, "utf8").toString("base64");
        this.writeFn(`\x1b]52;c;${encoded}\x07`);
        return Promise.resolve();
    }

    public readText(): Promise<string> {
        return Promise.resolve(this.buffer);
    }
}
