import { describe, expect, it } from "vitest";

import { LogLevel, logLevelName, parseLogLevel } from "./LogLevel.ts";

describe("LogLevel", () => {
    it("levels are ordered", () => {
        expect(LogLevel.Off).toBeLessThan(LogLevel.Trace);
        expect(LogLevel.Trace).toBeLessThan(LogLevel.Debug);
        expect(LogLevel.Debug).toBeLessThan(LogLevel.Info);
        expect(LogLevel.Info).toBeLessThan(LogLevel.Warn);
        expect(LogLevel.Warn).toBeLessThan(LogLevel.Error);
    });

    it("logLevelName returns lowercase name", () => {
        expect(logLevelName(LogLevel.Trace)).toBe("trace");
        expect(logLevelName(LogLevel.Debug)).toBe("debug");
        expect(logLevelName(LogLevel.Info)).toBe("info");
        expect(logLevelName(LogLevel.Warn)).toBe("warn");
        expect(logLevelName(LogLevel.Error)).toBe("error");
        expect(logLevelName(LogLevel.Off)).toBe("off");
    });

    it("parseLogLevel accepts standard names case-insensitively", () => {
        expect(parseLogLevel("debug")).toBe(LogLevel.Debug);
        expect(parseLogLevel("DEBUG")).toBe(LogLevel.Debug);
        expect(parseLogLevel("Info")).toBe(LogLevel.Info);
    });

    it("parseLogLevel accepts 'warning' as alias for warn", () => {
        expect(parseLogLevel("warning")).toBe(LogLevel.Warn);
        expect(parseLogLevel("warn")).toBe(LogLevel.Warn);
    });

    it("parseLogLevel returns undefined for unknown", () => {
        expect(parseLogLevel("verbose")).toBeUndefined();
        expect(parseLogLevel("")).toBeUndefined();
    });
});
