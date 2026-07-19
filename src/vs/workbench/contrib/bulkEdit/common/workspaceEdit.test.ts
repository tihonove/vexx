import { describe, expect, it } from "vitest";

import { isResourceFileEdit } from "./workspaceEdit.ts";

describe("isResourceFileEdit", () => {
    it("recognizes file edits by the kind discriminator", () => {
        expect(isResourceFileEdit({ kind: "move", from: "/a", to: "/b" })).toBe(true);
        expect(isResourceFileEdit({ kind: "delete", from: "/a" })).toBe(true);
    });

    it("rejects text edits (no kind field)", () => {
        expect(isResourceFileEdit({ resource: "/a", edits: [] })).toBe(false);
    });
});
