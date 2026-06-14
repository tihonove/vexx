import { describe, expect, it, vi } from "vitest";

import type { ILogger } from "../Common/Logging/ILogger.ts";

import type { IExtension } from "./IExtension.ts";
import { mergeExtensions } from "./mergeExtensions.ts";

function createLoggerMock(): ILogger & { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        isEnabled: () => true,
    } as unknown as ILogger & { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

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
        const logger = createLoggerMock();
        const result = mergeExtensions([ext("vscode.javascript", true)], [ext("vscode.javascript", false)], logger);
        expect(result).toHaveLength(1);
        expect(result[0].isBuiltin).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("shadowed by a builtin"));
    });

    it("dedupes within the same list", () => {
        const logger = createLoggerMock();
        const result = mergeExtensions([], [ext("a.b", false), ext("a.b", false)], logger);
        expect(result).toHaveLength(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Duplicate user extension"));
    });

    it("returns empty list when both inputs are empty", () => {
        expect(mergeExtensions([], [])).toEqual([]);
    });
});
