import { describe, expect, it, vi } from "vitest";

import type { IExtension } from "./IExtension.ts";
import { mergeExtensions } from "./mergeExtensions.ts";

function ext(id: string, isBuiltin: boolean): IExtension {
    const [publisher, name] = id.split(".");
    return {
        id,
        manifest: { name, publisher, version: "0.0.1" },
        location: `Stub/${id}/`,
        isBuiltin,
    } as IExtension;
}

describe("mergeExtensions", () => {
    it("concatenates non-conflicting lists", () => {
        const result = mergeExtensions([ext("vscode.javascript", true)], [ext("acme.theme", false)]);
        expect(result.map((e) => e.id)).toEqual(["vscode.javascript", "acme.theme"]);
    });

    it("builtin shadows user with the same id", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const result = mergeExtensions([ext("vscode.javascript", true)], [ext("vscode.javascript", false)]);
            expect(result).toHaveLength(1);
            expect(result[0].isBuiltin).toBe(true);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("shadowed by a builtin"));
        } finally {
            warn.mockRestore();
        }
    });

    it("dedupes within the same list", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const result = mergeExtensions([], [ext("a.b", false), ext("a.b", false)]);
            expect(result).toHaveLength(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("Duplicate user extension"));
        } finally {
            warn.mockRestore();
        }
    });

    it("returns empty list when both inputs are empty", () => {
        expect(mergeExtensions([], [])).toEqual([]);
    });
});
