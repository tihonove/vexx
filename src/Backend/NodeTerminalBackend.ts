import { Point, Size } from "../Common/GeometryPromitives.ts";
import { isInsideTmux } from "../Common/TerminalEnv.ts";
import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import { KeyInputParser } from "../Input/KeyInputParser.ts";
import { MOUSE_TRACKING_ALL_ENABLE, MOUSE_TRACKING_DISABLE } from "../Input/mouseTracking.ts";
import type { MouseToken } from "../Input/RawTerminalToken.ts";
import { Grid } from "../Rendering/Grid.ts";
import { TerminalRenderer } from "../Rendering/TerminalRenderer.ts";

import type { ITerminalBackend } from "./ITerminalBackend.ts";

/**
 * Kitty Keyboard Protocol escape sequences.
 *
 * Flags (push mode): disambiguate(1) + event types(2) + all keys as escapes(8) + alternate keys(4) = 15
 * Alternate keys (flag 4) makes the terminal report baseLayoutKey — the physical key position in the
 * base (US QWERTY) layout — as the third sub-parameter of the codepoint field. This lets us match
 * shortcuts like Ctrl+S regardless of the active keyboard layout (e.g. Russian).
 * See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
 */
const KITTY_ENABLE = "\x1b[>15u";
const KITTY_DISABLE = "\x1b[<u";

/**
 * Keyboard-protocol probe: query current Kitty flags (`CSI ? u`) immediately followed by
 * Primary Device Attributes (`CSI c`). Only Kitty-capable terminals answer the first; every
 * terminal answers DA1, so the DA1 reply is the "all replies are in" sentinel. The timeout
 * bounds the negative case (no reply at all → not supported).
 */
const KITTY_FLAGS_QUERY = "\x1b[?u";
const DA1_QUERY = "\x1b[c";
const KEYBOARD_PROBE_TIMEOUT_MS = 200;

/**
 * How long to hold a partial escape sequence that arrived at the end of a stdin read,
 * waiting for the rest to follow (it does, on a split keypress over SSH/tmux). If nothing
 * follows, the tail is flushed as-is — a lone ESC then resolves to the Escape key. Mirrors
 * the classic terminal "escape timeout"; 50ms keeps Escape responsive while absorbing splits.
 */
const PARTIAL_INPUT_FLUSH_MS = 50;

/**
 * Wrap an escape sequence for TMUX DCS passthrough.
 *
 * TMUX не понимает произвольные escape-последовательности и глотает их.
 * Чтобы передать их терминалу напрямую, нужно обернуть в DCS passthrough:
 *   \x1bPtmux;\x1b<sequence>\x1b\\
 *
 * Внутри passthrough каждый ESC (\x1b) в оригинальной последовательности
 * удваивается (\x1b → \x1b\x1b).
 *
 * See: https://github.com/tmux/tmux/wiki/FAQ#what-is-the-passthrough-escape-sequence-and-how-do-i-use-it
 */
function wrapForTmux(sequence: string): string {
    // eslint-disable-next-line no-control-regex
    const escaped = sequence.replace(/\x1b/g, "\x1b\x1b");
    return `\x1bPtmux;${escaped}\x1b\\`;
}

/**
 * Real terminal backend: reads from process.stdin, writes to process.stdout.
 * Handles alternate screen, raw mode, cursor visibility, signal cleanup.
 * Enables the Kitty Keyboard Protocol; inside tmux the input-mode sequences are sent
 * directly so tmux manages them per-pane (passthrough is reserved for OSC clipboard).
 */
export class NodeTerminalBackend implements ITerminalBackend {
    private inputCallbacks: ((event: KeyPressEvent) => void)[] = [];
    private mouseCallbacks: ((event: MouseToken) => void)[] = [];
    private resizeCallbacks: ((size: Size) => void)[] = [];
    private oscResponseCallbacks: ((code: number, data: string) => void)[] = [];
    private deviceReportCallbacks: ((report: "kitty-flags" | "da1", params: string) => void)[] = [];
    private stdin: NodeJS.ReadStream;
    private stdout: NodeJS.WriteStream;
    private onDataHandler: ((chunk: string) => void) | null = null;
    private partialInputTimer: ReturnType<typeof setTimeout> | null = null;
    private onResizeHandler: (() => void) | null = null;
    private resizeThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    private resizeThrottleMs: number;
    private lastEmittedSize: Size | null = null;
    private resizePending = false;
    private cleanupHandlers: (() => void)[] = [];
    private readonly isTmux: boolean;
    private readonly inputParser = new KeyInputParser();
    private readonly renderer: TerminalRenderer;
    private prevGrid: Grid | null = null;

    public constructor(
        stdin: NodeJS.ReadStream = process.stdin,
        stdout: NodeJS.WriteStream = process.stdout,
        options?: { resizeThrottleMs?: number },
    ) {
        this.stdin = stdin;
        this.stdout = stdout;
        this.resizeThrottleMs = options?.resizeThrottleMs ?? 100;
        this.isTmux = isInsideTmux();
        this.renderer = new TerminalRenderer(stdout);
    }

    /**
     * Write a raw escape sequence to stdout, wrapping in TMUX passthrough if needed.
     *
     * ВАЖНО: passthrough применять ТОЛЬКО к последовательностям, которые tmux НЕ понимает
     * и которые должны дойти до внешнего терминала напрямую (например, OSC 52 — буфер обмена).
     *
     * Последовательности режимов ВВОДА (Kitty keyboard protocol `CSI > u`/`CSI < u`/`CSI ? u`,
     * mouse tracking `?1000/1002/1003/1006`) tmux понимает и отслеживает ПОПАНЕЛЬНО — их нужно
     * слать напрямую (writeDirect), иначе passthrough включит режим на внешнем терминале глобально,
     * и кодировка клавиш «протечёт» во все панели tmux (Ctrl+S перестаёт быть префиксом, а в других
     * вкладках появляются `[115;5u`-подобные символы).
     */
    private writePassthrough(sequence: string): void {
        this.stdout.write(this.isTmux ? wrapForTmux(sequence) : sequence);
    }

    /**
     * Write a sequence straight to stdout without TMUX passthrough. Use for input-mode
     * sequences (Kitty keyboard protocol, mouse tracking) so tmux manages them per-pane.
     */
    private writeDirect(sequence: string): void {
        this.stdout.write(sequence);
    }

    /**
     * Write an OSC or other escape sequence to the terminal.
     * TMUX passthrough is applied automatically when running inside TMUX.
     */
    public writeOscSequence(sequence: string): void {
        this.writePassthrough(sequence);
    }

    public onInput(callback: (event: KeyPressEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    public onMouse(callback: (event: MouseToken) => void): void {
        this.mouseCallbacks.push(callback);
    }

    public onResize(callback: (size: Size) => void): void {
        this.resizeCallbacks.push(callback);
    }

    public onOscResponse(callback: (code: number, data: string) => void): void {
        this.oscResponseCallbacks.push(callback);
    }

    public probeKeyboardProtocol(onResult: (supported: boolean) => void): void {
        let settled = false;
        let supported = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const finish = (): void => {
            if (settled) return;
            settled = true;
            if (timer !== null) clearTimeout(timer);
            onResult(supported);
        };
        this.deviceReportCallbacks.push((report) => {
            if (settled) return;
            if (report === "kitty-flags") supported = true;
            else finish(); // DA1 reply = all replies are in
        });
        // Direct (not passthrough): the reply must reflect tmux's own Kitty support, per-pane.
        this.writeDirect(KITTY_FLAGS_QUERY + DA1_QUERY);
        timer = setTimeout(finish, KEYBOARD_PROBE_TIMEOUT_MS);
    }

    /** Fan a parsed input batch out to the registered callbacks. */
    private dispatchInput(result: ReturnType<KeyInputParser["parseWithMouse"]>): void {
        for (const event of result.keys) {
            for (const cb of this.inputCallbacks) cb(event);
        }
        for (const mouseToken of result.mouse) {
            for (const cb of this.mouseCallbacks) cb(mouseToken);
        }
        for (const oscToken of result.osc) {
            for (const cb of this.oscResponseCallbacks) cb(oscToken.code, oscToken.data);
        }
        for (const report of result.deviceReports) {
            for (const cb of this.deviceReportCallbacks) cb(report.report, report.params);
        }
    }

    /** If a partial sequence is buffered, flush it after a short grace period (the rest never came). */
    private schedulePartialInputFlush(): void {
        if (!this.inputParser.hasPending()) return;
        this.partialInputTimer = setTimeout(() => {
            this.partialInputTimer = null;
            this.dispatchInput(this.inputParser.flush());
        }, PARTIAL_INPUT_FLUSH_MS);
    }

    private clearPartialInputTimer(): void {
        if (this.partialInputTimer !== null) {
            clearTimeout(this.partialInputTimer);
            this.partialInputTimer = null;
        }
    }

    /** Emit resize only if dimensions actually changed */
    private emitResize(): void {
        const size = this.getSize();
        if (
            this.lastEmittedSize !== null &&
            this.lastEmittedSize.width === size.width &&
            this.lastEmittedSize.height === size.height
        ) {
            return;
        }
        this.lastEmittedSize = size;
        for (const cb of this.resizeCallbacks) {
            cb(size);
        }
    }

    public renderFrame(grid: Grid, cursorPosition: Point | null): void {
        this.prevGrid ??= new Grid(grid.size);
        const sizeChanged = this.prevGrid.width !== grid.width || this.prevGrid.height !== grid.height;
        if (sizeChanged) {
            this.prevGrid = new Grid(grid.size);
        }
        this.stdout.write("\x1b[?2026h"); // begin synchronized output
        this.stdout.write("\x1b[?25l"); // hide cursor
        if (sizeChanged) {
            this.stdout.write("\x1b[2J"); // clear screen to avoid stale reflow artifacts
        }
        this.renderer.render(grid, this.prevGrid);
        if (cursorPosition !== null) {
            this.stdout.write(`\x1b[${(cursorPosition.y + 1).toString()};${(cursorPosition.x + 1).toString()}H`); // position cursor
            this.stdout.write("\x1b[?25h"); // show cursor
        }
        this.stdout.write("\x1b[?2026l"); // end synchronized output
    }

    public getSize(): Size {
        return new Size(this.stdout.columns, this.stdout.rows);
    }

    public setup(): void {
        // Switch to alternate screen buffer
        this.stdout.write("\x1b[?1049h");
        // Show cursor (will be positioned by the focused element)
        this.stdout.write("\x1b[?25h");
        // Enable Kitty Keyboard Protocol — direct, so tmux tracks it per-pane (no passthrough)
        this.writeDirect(KITTY_ENABLE);
        // Enable mouse tracking (all-motion mode for hover/enter/leave) — direct, per-pane
        this.writeDirect(MOUSE_TRACKING_ALL_ENABLE);

        // Raw mode for character-by-character input
        this.stdin.setRawMode(true);
        this.stdin.setEncoding("utf8");
        this.stdin.resume();

        // Listen for input
        this.onDataHandler = (chunk: string) => {
            // A new chunk supersedes any buffered tail (it gets prepended inside the parser),
            // so cancel a pending flush; reschedule below if a tail still remains afterward.
            this.clearPartialInputTimer();
            this.dispatchInput(this.inputParser.parseWithMouse(chunk));
            this.schedulePartialInputFlush();
        };
        this.stdin.on("data", this.onDataHandler);

        // Listen for terminal resize (throttled + deduplicated)
        this.onResizeHandler = () => {
            if (this.resizeThrottleTimer !== null) {
                // Already throttling — just mark that a new resize arrived
                this.resizePending = true;
                return;
            }
            this.emitResize();
            this.resizeThrottleTimer = setTimeout(() => {
                this.resizeThrottleTimer = null;
                if (this.resizePending) {
                    this.resizePending = false;
                    this.emitResize();
                }
            }, this.resizeThrottleMs);
        };
        this.stdout.on("resize", this.onResizeHandler);

        // Cleanup on exit/SIGINT
        const onExit = () => {
            this.teardown();
        };
        const onSigint = () => {
            this.teardown();
            process.exit(0);
        };

        process.on("exit", onExit);
        process.on("SIGINT", onSigint);

        this.cleanupHandlers.push(() => {
            process.removeListener("exit", onExit);
            process.removeListener("SIGINT", onSigint);
        });
    }

    public teardown(): void {
        // Disable Kitty Keyboard Protocol — direct (matches the per-pane enable in setup)
        this.writeDirect(KITTY_DISABLE);
        // Disable mouse tracking — direct
        this.writeDirect(MOUSE_TRACKING_DISABLE);
        // Restore cursor
        this.stdout.write("\x1b[?25h");
        // Restore normal screen buffer
        this.stdout.write("\x1b[?1049l");

        // Remove stdin listener
        if (this.onDataHandler) {
            this.stdin.removeListener("data", this.onDataHandler);
            this.onDataHandler = null;
        }
        this.clearPartialInputTimer();

        // Cancel pending throttle and remove resize listener
        if (this.resizeThrottleTimer !== null) {
            clearTimeout(this.resizeThrottleTimer);
            this.resizeThrottleTimer = null;
        }
        this.resizePending = false;
        if (this.onResizeHandler) {
            this.stdout.removeListener("resize", this.onResizeHandler);
            this.onResizeHandler = null;
        }

        // Remove process listeners
        for (const cleanup of this.cleanupHandlers) {
            cleanup();
        }
        this.cleanupHandlers = [];
    }
}
