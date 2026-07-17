import type { LogEntry } from "../../Common/Logging/ILogService.ts";
import { type LogLevel, LogLevel as Level, logLevelName } from "../../Common/Logging/LogLevel.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import type { RenderContext } from "../TUIElement.ts";

import { ScrollableElement, type ScrollViewportInfo } from "./ScrollableElement.ts";

/** Colours per severity for the `[LEVEL]` token; owner pushes these from the theme. */
export interface OutputLevelColors {
    trace: number;
    debug: number;
    info: number;
    warn: number;
    error: number;
}

const DEFAULT_FG = packRgb(204, 204, 204);
const DEFAULT_BG = packRgb(24, 24, 24);
const DEFAULT_TIME_FG = packRgb(142, 142, 142);
const DEFAULT_LEVEL_COLORS: OutputLevelColors = {
    trace: packRgb(142, 142, 142),
    debug: packRgb(142, 142, 142),
    info: packRgb(117, 190, 255),
    warn: packRgb(204, 167, 0),
    error: packRgb(241, 76, 76),
};

/** Length of the `HH:MM:SS` timestamp prefix. */
const TIME_LEN = 8;

interface FormattedLine {
    readonly text: string;
    readonly level: LogLevel;
    /** Start column of the `[LEVEL]` token within {@link text}. */
    readonly levelStart: number;
    /** End column (exclusive) of the `[LEVEL]` token. */
    readonly levelEnd: number;
}

/**
 * Скроллируемый лог-вью для Output-панели: рендерит только видимые строки одного
 * канала (`setEntries` / `appendEntry`), с live-tail — пока вьюпорт прижат к низу,
 * новые записи автоскроллятся; ручной скролл вверх открепляет, возврат к низу —
 * прикрепляет обратно (как в VS Code). Скролл своим оффсетом — оборачивается в
 * `ScrollBarDecorator` контроллером. Цвета выставляются сеттерами из темы.
 */
export class OutputViewElement extends ScrollableElement {
    public fg = DEFAULT_FG;
    public bg = DEFAULT_BG;
    public timeFg = DEFAULT_TIME_FG;
    public levelColors: OutputLevelColors = DEFAULT_LEVEL_COLORS;

    private lines: FormattedLine[] = [];
    private maxLineWidth = 0;
    private stickToBottom = true;

    public constructor() {
        super();
        this.tabIndex = 0;
    }

    public override get contentHeight(): number {
        return this.lines.length;
    }

    public override get contentWidth(): number {
        return this.maxLineWidth;
    }

    /** Replaces the shown lines (e.g. on channel switch) and re-pins to the bottom. */
    public setEntries(entries: readonly LogEntry[]): void {
        this.lines = entries.map((entry) => formatEntry(entry));
        this.maxLineWidth = this.lines.reduce((max, line) => Math.max(max, line.text.length), 0);
        this.stickToBottom = true;
        this.markDirty();
    }

    /** Appends one line; auto-scrolls to it when the view is pinned to the bottom. */
    public appendEntry(entry: LogEntry): void {
        const line = formatEntry(entry);
        this.lines.push(line);
        this.maxLineWidth = Math.max(this.maxLineWidth, line.text.length);
        this.markDirty();
    }

    public clear(): void {
        this.lines = [];
        this.maxLineWidth = 0;
        this.stickToBottom = true;
        this.scrollTop = 0;
        this.markDirty();
    }

    /** True while the viewport is pinned to the newest line (live-tail on). */
    public isAtBottom(): boolean {
        return this.stickToBottom;
    }

    private maxScrollTop(): number {
        return Math.max(0, this.contentHeight - this.layoutSize.height);
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "wheel") {
            const wheel = event as TUIMouseEvent;
            this.scrollBy(0, wheel.wheelDirection === "up" ? -3 : 3);
            this.syncStick();
        } else if (event.type === "keydown") {
            this.handleKey(event as TUIKeyboardEvent);
        } else {
            super.performDefaultAction(event);
        }
    }

    private handleKey(event: TUIKeyboardEvent): void {
        const page = Math.max(1, this.layoutSize.height - 1);
        switch (event.key) {
            case "ArrowDown":
                this.scrollBy(0, 1);
                break;
            case "ArrowUp":
                this.scrollBy(0, -1);
                break;
            case "PageDown":
                this.scrollBy(0, page);
                break;
            case "PageUp":
                this.scrollBy(0, -page);
                break;
            case "Home":
                this.scrollTo(this.scrollLeft, 0);
                break;
            case "End":
                this.scrollTo(this.scrollLeft, this.maxScrollTop());
                break;
            default:
                return;
        }
        event.preventDefault();
        this.syncStick();
    }

    /** Re-derives the live-tail flag from the current scroll position after a user scroll. */
    private syncStick(): void {
        this.stickToBottom = this.scrollTop >= this.maxScrollTop();
        this.markDirty();
    }

    protected override renderViewport(context: RenderContext, viewport: ScrollViewportInfo): void {
        const { viewportWidth, viewportHeight } = viewport;

        // Live-tail: keep the newest line in view while pinned to the bottom.
        if (this.stickToBottom) this.scrollTop = this.maxScrollTop();
        const scrollTop = this.scrollTop;
        const scrollLeft = this.scrollLeft;

        for (let screenY = 0; screenY < viewportHeight; screenY++) {
            // Paint the row background first so gaps read as panel, not terminal.
            for (let x = 0; x < viewportWidth; x++) context.setCell(x, screenY, { char: " ", bg: this.bg });

            const line = this.lines[scrollTop + screenY];
            if (line === undefined) continue;

            context.drawText(
                -scrollLeft,
                screenY,
                line.text,
                { fg: this.fg, bg: this.bg },
                {
                    maxWidth: scrollLeft + viewportWidth,
                    getStyle: (offset) => {
                        if (offset < TIME_LEN) return { fg: this.timeFg };
                        if (offset >= line.levelStart && offset < line.levelEnd) {
                            return { fg: this.levelColors[levelKey(line.level)] };
                        }
                        return undefined;
                    },
                },
            );
        }
    }
}

function levelKey(level: LogLevel): keyof OutputLevelColors {
    switch (level) {
        case Level.Error:
            return "error";
        case Level.Warn:
            return "warn";
        case Level.Info:
            return "info";
        case Level.Debug:
            return "debug";
        default:
            return "trace";
    }
}

function formatEntry(entry: LogEntry): FormattedLine {
    const time = new Date(entry.timestamp).toISOString().slice(11, 19); // HH:MM:SS (UTC)
    const levelToken = `[${logLevelName(entry.level).toUpperCase()}]`;
    let text = `${time} ${levelToken} ${entry.message}`;
    for (const arg of entry.args) text += " " + stringifyArg(arg);
    text = text.replace(/\r?\n/g, " "); // one row per entry
    const levelStart = TIME_LEN + 1;
    return { text, level: entry.level, levelStart, levelEnd: levelStart + levelToken.length };
}

function stringifyArg(value: unknown): string {
    if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
