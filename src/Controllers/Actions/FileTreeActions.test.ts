import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { parseKeybinding } from "../../vs/platform/keybinding/common/keybindingsRegistry.ts";

import { fileDeleteAction } from "./FileTreeActions.ts";

describe("fileDeleteAction", () => {
    let ws: ITempWorkspace;
    let filePath: string;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-file-delete-", files: { "target.txt": "content" } });
        filePath = ws.path("target.txt");
    });

    afterEach(() => {
        ws.dispose();
    });

    it("has correct id", () => {
        expect(fileDeleteAction.id).toBe("fileOperations.deleteFile");
    });

    it("has correct title", () => {
        expect(fileDeleteAction.title).toBe("File: Delete");
    });

    it("is bound to the Delete key while a list is focused", () => {
        expect(fileDeleteAction.keybinding).toEqual(parseKeybinding("delete"));
        expect(fileDeleteAction.when).toBe("listFocus");
    });

    it("deletes a file from the filesystem", () => {
        expect(fs.existsSync(filePath)).toBe(true);

        fileDeleteAction.run(null as never, filePath);

        expect(fs.existsSync(filePath)).toBe(false);
    });

    it("deletes a directory recursively", () => {
        const dirPath = ws.path("subdir");
        ws.writeFile("subdir/inner.txt", "data");

        fileDeleteAction.run(null as never, dirPath);

        expect(fs.existsSync(dirPath)).toBe(false);
    });

    it("does not throw if file does not exist (force: true)", () => {
        const nonExistent = ws.path("ghost.txt");
        expect(() => fileDeleteAction.run(null as never, nonExistent)).not.toThrow();
    });
});
