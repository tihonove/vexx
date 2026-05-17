import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LogEntry } from "../ILogService.ts";
import { LogLevel } from "../LogLevel.ts";

import { FileSink } from "./FileSink.ts";

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
    return {
        timestamp: Date.parse("2026-01-02T03:04:05.000Z"),
        channel: "ch",
        level: LogLevel.Info,
        message: "hello",
        args: [],
        ...overrides,
    };
}

async function flushAndDispose(sink: FileSink): Promise<void> {
    sink.dispose();
    // FileSink.dispose() вызывает stream.end() — небольшой tick для записи на диск.
    await new Promise((r) => setTimeout(r, 20));
}

describe("FileSink", () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-filesink-"));
        file = path.join(dir, "vexx.log");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("writes formatted line per entry", async () => {
        const sink = new FileSink(file);
        sink.append(entry({ message: "hello world" }));
        await flushAndDispose(sink);

        const content = fs.readFileSync(file, "utf8");
        expect(content).toBe("[2026-01-02T03:04:05.000Z] [INFO ] [ch] hello world\n");
    });

    it("appends args separated by tabs (json for plain values)", async () => {
        const sink = new FileSink(file);
        sink.append(entry({ message: "x", args: [{ a: 1 }, "str", 42] }));
        await flushAndDispose(sink);

        const content = fs.readFileSync(file, "utf8");
        expect(content).toContain('x\t{"a":1}\tstr\t42\n');
    });

    it("serializes Error with stack", async () => {
        const err = new Error("boom");
        const sink = new FileSink(file);
        sink.append(entry({ level: LogLevel.Error, message: "fail", args: [err] }));
        await flushAndDispose(sink);

        const content = fs.readFileSync(file, "utf8");
        expect(content).toContain("[ERROR]");
        expect(content).toContain("fail\t");
        expect(content).toMatch(/Error: boom/);
    });

    it("truncates file on construction with flags=w (default)", async () => {
        fs.writeFileSync(file, "old content\n");
        const sink = new FileSink(file);
        sink.append(entry({ message: "new" }));
        await flushAndDispose(sink);

        const content = fs.readFileSync(file, "utf8");
        expect(content).not.toContain("old content");
        expect(content).toContain("new");
    });

    it("appends with flags=a", async () => {
        fs.writeFileSync(file, "old line\n");
        const sink = new FileSink(file, { flags: "a" });
        sink.append(entry({ message: "new" }));
        await flushAndDispose(sink);

        const content = fs.readFileSync(file, "utf8");
        expect(content.startsWith("old line\n")).toBe(true);
        expect(content).toContain("new");
    });

    it("append after dispose is no-op (does not throw)", async () => {
        const sink = new FileSink(file);
        await flushAndDispose(sink);
        expect(() => sink.append(entry())).not.toThrow();
    });

    it("does not throw if file path is invalid", () => {
        // На invalid path конструктор может не бросить (createWriteStream ленив),
        // но и не должен падать на append.
        const sink = new FileSink(path.join(dir, "nonexistent-subdir", "x.log"));
        expect(() => sink.append(entry())).not.toThrow();
        expect(() => sink.dispose()).not.toThrow();
    });

    it("multiple dispose calls are safe", async () => {
        const sink = new FileSink(file);
        sink.dispose();
        expect(() => sink.dispose()).not.toThrow();
    });
});
