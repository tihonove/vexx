import { describe, expect, it } from "vitest";

import { reject } from "./types.ts";

describe("reject", () => {
    it("throws an unexpected-state error", () => {
        expect(() => reject()).toThrow("Unexpected state");
    });
});
