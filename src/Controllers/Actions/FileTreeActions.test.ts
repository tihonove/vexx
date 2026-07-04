import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseKeybinding } from "../KeybindingRegistry.ts";

import { fileDeleteAction } from "./FileTreeActions.ts";

describe("fileDeleteAction", () => {
    let tmpDir: string;
    let filePath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-file-delete-"));
        filePath = path.join(tmpDir, "target.txt");
        fs.writeFileSync(filePath, "content");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
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
        const dirPath = path.join(tmpDir, "subdir");
        fs.mkdirSync(dirPath);
        fs.writeFileSync(path.join(dirPath, "inner.txt"), "data");

        fileDeleteAction.run(null as never, dirPath);

        expect(fs.existsSync(dirPath)).toBe(false);
    });

    it("does not throw if file does not exist (force: true)", () => {
        const nonExistent = path.join(tmpDir, "ghost.txt");
        expect(() => fileDeleteAction.run(null as never, nonExistent)).not.toThrow();
    });
});
