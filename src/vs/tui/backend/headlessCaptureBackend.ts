import { Point, Size } from "../../../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../input/keyEvent.ts";
import { KeyInputParser } from "../input/keyInputParser.ts";
import type { MouseToken } from "../input/rawTerminalToken.ts";
import { serializeKey } from "../input/serializeKey.ts";
import type { Grid } from "../rendering/grid.ts";
import { emptyGridSnapshot, type GridSnapshot, snapshotGrid } from "../rendering/gridSnapshot.ts";

import type { ITerminalBackend } from "./terminalBackend.ts";

/**
 * Terminal backend that runs the real application without a real terminal.
 *
 * Unlike {@link import("./nodeTerminalBackend.ts").NodeTerminalBackend} it never
 * touches stdin/stdout: `setup`/`teardown` are no-ops and rendered frames are
 * captured into a {@link GridSnapshot} instead of being written as ANSI. Input is
 * injected the same way {@link import("./mockTerminalBackend.ts").MockTerminalBackend}
 * does it — through the real {@link KeyInputParser} and {@link serializeKey} DSL —
 * so the app sees byte-for-byte the same `KeyPressEvent`s a terminal would produce.
 *
 * Drives the `--headless` mode: the inspector exposes {@link sendKey} /
 * {@link captureFrame} over WebSocket so a client can script the editor and read
 * back the screen for image rendering.
 */
export class HeadlessCaptureBackend implements ITerminalBackend {
    private readonly inputCallbacks: ((event: KeyPressEvent) => void)[] = [];
    private readonly mouseCallbacks: ((event: MouseToken) => void)[] = [];
    private readonly pasteCallbacks: ((text: string) => void)[] = [];
    private readonly resizeCallbacks: ((size: Size) => void)[] = [];
    private readonly oscResponseCallbacks: ((code: number, data: string) => void)[] = [];
    private readonly inputParser = new KeyInputParser();

    private size: Size;
    private lastFrame: GridSnapshot;

    public constructor(size: Size = new Size(120, 32)) {
        this.size = size;
        this.lastFrame = emptyGridSnapshot(size.width, size.height);
    }

    // ─── ITerminalBackend ───

    public onInput(callback: (event: KeyPressEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    public onMouse(callback: (event: MouseToken) => void): void {
        this.mouseCallbacks.push(callback);
    }

    public onPaste(callback: (text: string) => void): void {
        this.pasteCallbacks.push(callback);
    }

    public onResize(callback: (size: Size) => void): void {
        this.resizeCallbacks.push(callback);
    }

    public onOscResponse(callback: (code: number, data: string) => void): void {
        this.oscResponseCallbacks.push(callback);
    }

    /**
     * There is no terminal to probe. We never resolve the callback: leaving the
     * probe pending is harmless (it is fire-and-forget) and keeps capabilities at
     * their deterministic env-derived baseline, which matters for reproducible
     * screenshots.
     */
    public probeKeyboardProtocol(_onResult: (supported: boolean) => void): void {
        // intentionally never resolved — see doc comment
    }

    public renderFrame(grid: Grid, cursorPosition: Point | null): void {
        this.lastFrame = snapshotGrid(grid, cursorPosition);
    }

    public getSize(): Size {
        return this.size;
    }

    public setup(): void {
        // No terminal to initialize.
    }

    public teardown(): void {
        // No terminal to restore.
    }

    /** OSC output (e.g. clipboard writes) has nowhere to go in headless mode. */
    public writeOscSequence(_sequence: string): void {
        // No-op: no terminal to receive the sequence.
    }

    // ─── Driver surface (used by the inspector in headless mode) ───

    /**
     * Inject a key using the human-readable DSL (`"a"`, `"Enter"`, `"Ctrl+P"`).
     * Goes through the same parser as real terminal input.
     */
    public sendKey(name: string): void {
        this.sendRaw(serializeKey(name));
        // serializeKey always yields a complete sequence, so drain any tail a lone
        // ESC ("Escape") would otherwise leave buffered awaiting a continuation.
        if (this.inputParser.hasPending()) {
            this.emitStreams(this.inputParser.flush());
        }
    }

    /** Inject a bracketed paste: `text` is delivered to paste subscribers as one block. */
    public sendPaste(text: string): void {
        this.sendRaw(`\x1b[200~${text}\x1b[201~`);
    }

    /** Inject raw terminal bytes (escape sequences etc.) for edge cases. */
    public sendRaw(data: string): void {
        this.emitStreams(this.inputParser.parseWithMouse(data));
    }

    /** Inject a mouse event. */
    public simulateMouse(token: MouseToken): void {
        for (const cb of this.mouseCallbacks) cb(token);
    }

    /** Resize the virtual terminal and notify the application. */
    public resize(size: Size): void {
        this.size = size;
        for (const cb of this.resizeCallbacks) cb(size);
    }

    /** The most recently rendered frame as plain data. */
    public captureFrame(): GridSnapshot {
        return this.lastFrame;
    }

    private emitStreams(streams: ReturnType<KeyInputParser["parseWithMouse"]>): void {
        for (const event of streams.keys) {
            for (const cb of this.inputCallbacks) cb(event);
        }
        for (const text of streams.paste) {
            for (const cb of this.pasteCallbacks) cb(text);
        }
    }
}
