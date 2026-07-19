import { describe, expect, it } from "vitest";

import { NULL_STATE } from "./iState.ts";

describe("NULL_STATE", () => {
    it("clone() returns the same singleton instance", () => {
        const cloned = NULL_STATE.clone();
        expect(cloned).toBe(NULL_STATE);
    });

    it("equals() is true only for the NULL_STATE singleton", () => {
        expect(NULL_STATE.equals(NULL_STATE)).toBe(true);
        expect(NULL_STATE.equals(NULL_STATE.clone())).toBe(true);
    });

    it("equals() is false for any other state object", () => {
        const other = { clone: () => other, equals: () => false };
        expect(NULL_STATE.equals(other)).toBe(false);
    });
});
