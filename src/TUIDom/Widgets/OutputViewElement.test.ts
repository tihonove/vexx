import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import type { LogEntry } from "../../Common/Logging/ILogService.ts";
import { LogLevel } from "../../Common/Logging/LogLevel.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import { OutputViewElement } from "./OutputViewElement.ts";

/** Fixed UTC timestamp → "12:34:56". */
const TS = Date.UTC(2026, 0, 1, 12, 34, 56);

function entry(message: string, level: LogLevel = LogLevel.Info): LogEntry {
    return { timestamp: TS, channel: "test", level, message, args: [] };
}

function renderLines(view: OutputViewElement, width: number, height: number): string[] {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    view.performLayout(BoxConstraints.tight(size));
    view.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend.screenToString().split("\n").map((l) => l.trimEnd());
}

describe("OutputViewElement", () => {
    it("reports content size from entries", () => {
        const view = new OutputViewElement();
        view.setEntries([entry("hello"), entry("a longer message here")]);
        expect(view.contentHeight).toBe(2);
        // "12:34:56 [INFO] a longer message here"
        expect(view.contentWidth).toBe("12:34:56 [INFO] a longer message here".length);
    });

    it("formats a line as `HH:MM:SS [LEVEL] message`", () => {
        const view = new OutputViewElement();
        view.setEntries([entry("hello", LogLevel.Warn)]);
        const lines = renderLines(view, 40, 1);
        expect(lines[0]).toBe("12:34:56 [WARN] hello");
    });

    it("appends args after the message", () => {
        const view = new OutputViewElement();
        view.setEntries([{ timestamp: TS, channel: "c", level: LogLevel.Info, message: "cfg", args: [{ n: 1 }] }]);
        expect(renderLines(view, 40, 1)[0]).toBe('12:34:56 [INFO] cfg {"n":1}');
    });

    describe("live-tail", () => {
        it("pins to the newest lines and follows appends", () => {
            const view = new OutputViewElement();
            view.setEntries([entry("l0"), entry("l1"), entry("l2"), entry("l3"), entry("l4")]);

            // Height 3 → newest three lines (l2, l3, l4) are shown while pinned.
            let lines = renderLines(view, 40, 3);
            expect(lines.map((l) => l.split("] ")[1])).toEqual(["l2", "l3", "l4"]);
            expect(view.isAtBottom()).toBe(true);

            view.appendEntry(entry("l5"));
            lines = renderLines(view, 40, 3);
            expect(lines.map((l) => l.split("] ")[1])).toEqual(["l3", "l4", "l5"]);
        });

        it("unpins on manual scroll up and stays put on append", () => {
            const view = new OutputViewElement();
            view.setEntries([entry("l0"), entry("l1"), entry("l2"), entry("l3"), entry("l4")]);
            renderLines(view, 40, 3); // establishes layout + pins to bottom

            view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Home" }));
            expect(view.isAtBottom()).toBe(false);

            let lines = renderLines(view, 40, 3);
            expect(lines.map((l) => l.split("] ")[1])).toEqual(["l0", "l1", "l2"]);

            view.appendEntry(entry("l5")); // should NOT jump to bottom
            lines = renderLines(view, 40, 3);
            expect(lines.map((l) => l.split("] ")[1])).toEqual(["l0", "l1", "l2"]);
        });

        it("re-pins when the user scrolls back to the bottom", () => {
            const view = new OutputViewElement();
            view.setEntries([entry("l0"), entry("l1"), entry("l2"), entry("l3"), entry("l4")]);
            renderLines(view, 40, 3);

            view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Home" }));
            expect(view.isAtBottom()).toBe(false);
            view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "End" }));
            expect(view.isAtBottom()).toBe(true);
        });
    });

    it("clear empties the view", () => {
        const view = new OutputViewElement();
        view.setEntries([entry("l0"), entry("l1")]);
        view.clear();
        expect(view.contentHeight).toBe(0);
        expect(view.contentWidth).toBe(0);
        expect(renderLines(view, 40, 1)[0]).toBe("");
    });

    describe("scroll input", () => {
        function many(): OutputViewElement {
            const view = new OutputViewElement();
            view.setEntries(Array.from({ length: 10 }, (_, i) => entry(`l${i}`)));
            renderLines(view, 40, 3); // establish layout + pin to bottom
            return view;
        }

        function wheel(view: OutputViewElement, direction: "up" | "down"): void {
            view.dispatchEvent(
                new TUIMouseEvent("wheel", {
                    button: "none",
                    screenX: 0,
                    screenY: 0,
                    localX: 0,
                    localY: 0,
                    wheelDirection: direction,
                }),
            );
        }

        it("wheel up unpins and wheel back down re-pins", () => {
            const view = many();
            expect(view.isAtBottom()).toBe(true);
            wheel(view, "up");
            expect(view.isAtBottom()).toBe(false);
            wheel(view, "down");
            wheel(view, "down");
            expect(view.isAtBottom()).toBe(true);
        });

        it("arrow and page keys scroll the viewport", () => {
            const view = many();
            for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
                expect(() => view.dispatchEvent(new TUIKeyboardEvent("keydown", { key }))).not.toThrow();
            }
            // PageUp from the bottom scrolls up and unpins.
            view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "PageUp" }));
            expect(view.isAtBottom()).toBe(false);
        });

        it("ignores unhandled keys and non-scroll events", () => {
            const view = many();
            expect(() => {
                view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "x" })); // default → return
                view.dispatchEvent(new TUIKeyboardEvent("keyup", { key: "ArrowDown" })); // super path
            }).not.toThrow();
        });
    });

    it("stringifies args by type (string, Error with/without stack, unserializable)", () => {
        const withStack = new Error("boom");
        const noStack = new Error("plain-error");
        noStack.stack = undefined;
        const view = new OutputViewElement();
        view.setEntries([
            { timestamp: TS, channel: "c", level: LogLevel.Info, message: "m", args: ["hi"] },
            { timestamp: TS, channel: "c", level: LogLevel.Error, message: "m", args: [withStack] },
            { timestamp: TS, channel: "c", level: LogLevel.Error, message: "m", args: [noStack] },
            { timestamp: TS, channel: "c", level: LogLevel.Info, message: "m", args: [10n] }, // BigInt → JSON throws
        ]);
        const lines = renderLines(view, 200, 4);
        expect(lines[0]).toContain("hi");
        expect(lines[1]).toContain("boom"); // from the stack
        expect(lines[2]).toContain("Error: plain-error"); // stack-less fallback
        expect(lines[3]).toContain("10"); // String(10n)
    });

    it("colours the level token for every severity", () => {
        const view = new OutputViewElement();
        view.setEntries([
            entry("t", LogLevel.Trace),
            entry("d", LogLevel.Debug),
            entry("i", LogLevel.Info),
            entry("w", LogLevel.Warn),
            entry("e", LogLevel.Error),
        ]);
        const lines = renderLines(view, 40, 5);
        expect(lines.map((l) => l.match(/\[(\w+)\]/)?.[1])).toEqual(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]);
    });
});
