import { describe, it, expect } from "vitest";

import { CliArgsError, parseCliArgs } from "./CliArgs.ts";

describe("parseCliArgs", () => {
    it("returns empty result for empty argv", () => {
        const r = parseCliArgs([]);
        expect(r.positional).toEqual([]);
        expect(r.userDataDir).toBeUndefined();
        expect(r.profile).toBeUndefined();
        expect(r.help).toBe(false);
    });

    it("collects positional arguments", () => {
        const r = parseCliArgs(["a.ts", "b.ts", "src/"]);
        expect(r.positional).toEqual(["a.ts", "b.ts", "src/"]);
    });

    it("parses --user-data-dir with separate value", () => {
        const r = parseCliArgs(["--user-data-dir", "/tmp/vexx", "file.ts"]);
        expect(r.userDataDir).toBe("/tmp/vexx");
        expect(r.positional).toEqual(["file.ts"]);
    });

    it("parses --user-data-dir=<path>", () => {
        const r = parseCliArgs(["--user-data-dir=/tmp/vexx", "file.ts"]);
        expect(r.userDataDir).toBe("/tmp/vexx");
        expect(r.positional).toEqual(["file.ts"]);
    });

    it("parses --profile", () => {
        expect(parseCliArgs(["--profile", "compact"]).profile).toBe("compact");
        expect(parseCliArgs(["--profile=compact"]).profile).toBe("compact");
    });

    it("supports -h and --help", () => {
        expect(parseCliArgs(["-h"]).help).toBe(true);
        expect(parseCliArgs(["--help"]).help).toBe(true);
    });

    it("treats arguments after -- as positional", () => {
        const r = parseCliArgs(["--user-data-dir", "/tmp/v", "--", "--profile", "x"]);
        expect(r.userDataDir).toBe("/tmp/v");
        expect(r.profile).toBeUndefined();
        expect(r.positional).toEqual(["--profile", "x"]);
    });

    it("throws on unknown option", () => {
        expect(() => parseCliArgs(["--nope"])).toThrow(CliArgsError);
        expect(() => parseCliArgs(["-x"])).toThrow(CliArgsError);
    });

    it("throws when option value missing", () => {
        expect(() => parseCliArgs(["--profile"])).toThrow(/requires a value/);
        expect(() => parseCliArgs(["--user-data-dir="])).toThrow(/non-empty value/);
    });

    it("combines flags and positional in any order", () => {
        const r = parseCliArgs(["file.ts", "--profile", "compact", "another.ts"]);
        expect(r.positional).toEqual(["file.ts", "another.ts"]);
        expect(r.profile).toBe("compact");
    });

    it("treats `-` as positional (stdin convention)", () => {
        const r = parseCliArgs(["-"]);
        expect(r.positional).toEqual(["-"]);
    });
});
