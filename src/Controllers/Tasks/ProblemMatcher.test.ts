import { describe, expect, it } from "vitest";

import type { IMarkerData } from "../../Editor/Markers/IMarker.ts";
import { MarkerSeverity } from "../../Editor/Markers/IMarker.ts";

import type { IProblemMatcher } from "./ITask.ts";
import { resolveNamedMatcher } from "./NamedMatchers.ts";
import { ProblemMatcher } from "./ProblemMatcher.ts";

// Тривиальный резолвер: путь как есть, префиксом — чтобы видеть ключ ресурса.
const resolve = (file: string): string => `res:${file}`;

function run(matcher: IProblemMatcher, lines: string[]): ReadonlyMap<string, IMarkerData[]> {
    const m = new ProblemMatcher(matcher, resolve);
    for (const line of lines) m.processLine(line);
    return m.getMarkers();
}

describe("ProblemMatcher — single-line ($tsc)", () => {
    const tsc = resolveNamedMatcher("$tsc")!;

    it("parses a tsc error line into a marker with 0-based range", () => {
        const markers = run(tsc, ["app.ts(3,5): error TS2322: Type 'number' is not assignable to 'string'."]);
        const list = markers.get("res:app.ts")!;
        expect(list).toHaveLength(1);
        expect(list[0].severity).toBe(MarkerSeverity.Error);
        expect(list[0].code).toBe("TS2322");
        expect(list[0].source).toBe("ts");
        expect(list[0].message).toContain("not assignable");
        // (3,5) 1-based → (2,4) 0-based, минимум 1 символ ширины.
        expect(list[0].range.start).toEqual({ line: 2, character: 4 });
        expect(list[0].range.end).toEqual({ line: 2, character: 5 });
    });

    it("maps the severity word and accumulates several lines per resource", () => {
        const markers = run(tsc, [
            "a.ts(1,1): error TS1: boom",
            "a.ts(2,1): warning TS2: meh",
            "noise that does not match",
        ]);
        const list = markers.get("res:a.ts")!;
        expect(list).toHaveLength(2);
        expect(list[0].severity).toBe(MarkerSeverity.Error);
        expect(list[1].severity).toBe(MarkerSeverity.Warning);
    });
});

describe("ProblemMatcher — multi-line with loop", () => {
    const matcher: IProblemMatcher = {
        owner: "demo",
        fileLocation: "absolute",
        pattern: [
            { regexp: "^(ERROR|WARN): (.+)$", severity: 1, message: 2 },
            { regexp: "^\\s+at (.+):(\\d+)$", file: 1, line: 2, loop: true },
        ],
    };

    it("emits one marker per looped location under a shared header", () => {
        const markers = run(matcher, [
            "ERROR: something broke",
            "    at src/a.ts:10",
            "    at src/b.ts:20",
        ]);
        expect(markers.get("res:src/a.ts")).toHaveLength(1);
        expect(markers.get("res:src/b.ts")).toHaveLength(1);
        const a = markers.get("res:src/a.ts")![0];
        expect(a.message).toBe("something broke");
        expect(a.severity).toBe(MarkerSeverity.Error);
        expect(a.range.start.line).toBe(9); // line 10 → 0-based 9
    });

    it("resets on a non-matching line so a new header starts fresh", () => {
        const markers = run(matcher, [
            "ERROR: first",
            "    at a:1",
            "unrelated",
            "WARN: second",
            "    at b:2",
        ]);
        expect(markers.get("res:a")![0].message).toBe("first");
        expect(markers.get("res:b")![0].message).toBe("second");
        expect(markers.get("res:b")![0].severity).toBe(MarkerSeverity.Warning);
    });
});

describe("ProblemMatcher — $eslint-stylish (multi-line file header + loop)", () => {
    const eslint = resolveNamedMatcher("$eslint-stylish")!;

    it("parses stylish output: file header then indented problem lines", () => {
        const markers = run(eslint, [
            "/abs/src/a.ts",
            "  43:29  error  Replace quotes  prettier/prettier",
            "  76:9   warning  Run autofix to sort these imports  simple-import-sort/imports",
            "",
            "/abs/src/b.ts",
            "  1:1  error  Unsafe assignment of an `any` value  @typescript-eslint/no-unsafe-assignment",
            "",
            "✖ 3 problems (2 errors, 1 warning)",
        ]);

        const a = markers.get("res:/abs/src/a.ts")!;
        expect(a).toHaveLength(2);
        expect(a[0].severity).toBe(MarkerSeverity.Error);
        expect(a[0].message).toBe("Replace quotes");
        expect(a[0].code).toBe("prettier/prettier");
        expect(a[0].range.start).toEqual({ line: 42, character: 28 });
        expect(a[1].severity).toBe(MarkerSeverity.Warning);

        const b = markers.get("res:/abs/src/b.ts")!;
        expect(b).toHaveLength(1);
        expect(b[0].code).toBe("@typescript-eslint/no-unsafe-assignment");
        // Строка-саммари (✖ …) не рождает маркеров.
        expect(markers.has("res:✖ 3 problems (2 errors, 1 warning)")).toBe(false);
    });
});

describe("ProblemMatcher — location capture", () => {
    const matcher: IProblemMatcher = {
        owner: "nvcc",
        fileLocation: "absolute",
        pattern: { regexp: "^(.*)\\((\\d+)\\):\\s+(warning|error):\\s+(.*)$", file: 1, location: 2, severity: 3, message: 4 },
    };

    it("reads a single-number location into the line", () => {
        const markers = run(matcher, ["kernel.cu(42): error: bad thing"]);
        const marker = markers.get("res:kernel.cu")![0];
        expect(marker.range.start.line).toBe(41);
    });
});
