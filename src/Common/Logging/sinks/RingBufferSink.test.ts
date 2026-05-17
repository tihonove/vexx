import { describe, expect, it, vi } from "vitest";

import type { LogEntry } from "../ILogService.ts";
import { LogLevel } from "../LogLevel.ts";

import { RingBufferSink } from "./RingBufferSink.ts";

function entry(channel: string, message: string): LogEntry {
    return { timestamp: 0, channel, level: LogLevel.Info, message, args: [] };
}

describe("RingBufferSink", () => {
    it("stores entries per channel", () => {
        const sink = new RingBufferSink();
        sink.append(entry("a", "1"));
        sink.append(entry("b", "2"));
        sink.append(entry("a", "3"));

        expect(sink.getEntries("a").map((e) => e.message)).toEqual(["1", "3"]);
        expect(sink.getEntries("b").map((e) => e.message)).toEqual(["2"]);
    });

    it("getEntries returns empty for unknown channel", () => {
        const sink = new RingBufferSink();
        expect(sink.getEntries("nope")).toEqual([]);
    });

    it("getChannels returns all channels that have entries", () => {
        const sink = new RingBufferSink();
        sink.append(entry("a", "1"));
        sink.append(entry("b", "2"));
        expect([...sink.getChannels()].sort()).toEqual(["a", "b"]);
    });

    it("respects capacity per channel (drops oldest)", () => {
        const sink = new RingBufferSink({ capacityPerChannel: 3 });
        sink.append(entry("x", "1"));
        sink.append(entry("x", "2"));
        sink.append(entry("x", "3"));
        sink.append(entry("x", "4"));
        sink.append(entry("x", "5"));
        expect(sink.getEntries("x").map((e) => e.message)).toEqual(["3", "4", "5"]);
    });

    it("capacity is per-channel, not global", () => {
        const sink = new RingBufferSink({ capacityPerChannel: 2 });
        sink.append(entry("a", "1"));
        sink.append(entry("a", "2"));
        sink.append(entry("b", "1"));
        sink.append(entry("b", "2"));
        sink.append(entry("a", "3"));

        expect(sink.getEntries("a").map((e) => e.message)).toEqual(["2", "3"]);
        expect(sink.getEntries("b").map((e) => e.message)).toEqual(["1", "2"]);
    });

    it("clear(channel) removes only that channel", () => {
        const sink = new RingBufferSink();
        sink.append(entry("a", "1"));
        sink.append(entry("b", "2"));
        sink.clear("a");
        expect(sink.getEntries("a")).toEqual([]);
        expect(sink.getEntries("b")).toHaveLength(1);
    });

    it("clear() removes everything", () => {
        const sink = new RingBufferSink();
        sink.append(entry("a", "1"));
        sink.append(entry("b", "2"));
        sink.clear();
        expect(sink.getChannels()).toEqual([]);
    });

    it("onAppend callback is invoked after storage", () => {
        const cb = vi.fn();
        const sink = new RingBufferSink({ onAppend: cb });
        const e = entry("a", "1");
        sink.append(e);
        expect(cb).toHaveBeenCalledWith(e);
    });

    it("dispose clears buffers", () => {
        const sink = new RingBufferSink();
        sink.append(entry("a", "1"));
        sink.dispose();
        expect(sink.getChannels()).toEqual([]);
    });
});
