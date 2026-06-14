import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadUserKeybindings } from "./KeybindingsService.ts";

describe("loadUserKeybindings", () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-keys-"));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    function write(content: string): string {
        const file = path.join(dir, "keybindings.json");
        fs.writeFileSync(file, content);
        return file;
    }

    it("returns [] when the file does not exist", async () => {
        const rules = await loadUserKeybindings(path.join(dir, "missing.json"));
        expect(rules).toEqual([]);
    });

    it("parses valid rules (JSONC, trailing commas allowed)", async () => {
        const file = write(`[
            // word right on kitty
            { "key": "ctrl+shift+right", "command": "cursorWordRight", "when": "tier == 'kitty'" },
            { "key": "ctrl+s", "command": "save" },
        ]`);
        const rules = await loadUserKeybindings(file);
        expect(rules).toEqual([
            { key: "ctrl+shift+right", command: "cursorWordRight", when: "tier == 'kitty'", args: undefined },
            { key: "ctrl+s", command: "save", when: undefined, args: undefined },
        ]);
    });

    it("accepts an unbind rule (-command) with or without a key", async () => {
        const file = write(`[
            { "key": "ctrl+s", "command": "-save" },
            { "command": "-cursorWordRight" }
        ]`);
        const rules = await loadUserKeybindings(file);
        expect(rules).toHaveLength(2);
        expect(rules[1]).toEqual({ key: "", command: "-cursorWordRight", when: undefined, args: undefined });
    });

    it("drops invalid rules (missing command, missing key on an add) and keeps the rest", async () => {
        const file = write(`[
            { "key": "ctrl+s" },
            { "command": "addWithoutKey" },
            { "key": "ctrl+x", "command": "cut" }
        ]`);
        const rules = await loadUserKeybindings(file);
        expect(rules).toEqual([{ key: "ctrl+x", command: "cut", when: undefined, args: undefined }]);
    });

    it("returns [] for a non-array document", async () => {
        const file = write(`{ "key": "ctrl+s", "command": "save" }`);
        const rules = await loadUserKeybindings(file);
        expect(rules).toEqual([]);
    });

    it("is best-effort on broken JSONC (does not throw)", async () => {
        const file = write(`[ { "key": "ctrl+s", "command": "save" } `); // missing closing bracket
        const rules = await loadUserKeybindings(file);
        // jsonc-parser recovers the well-formed object.
        expect(rules).toEqual([{ key: "ctrl+s", command: "save", when: undefined, args: undefined }]);
    });

    it("logs and returns [] when the file can't be read (non-ENOENT error)", async () => {
        // A directory path → readFile throws EISDIR, the non-missing-file branch.
        const logger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), isEnabled: () => true };
        const rules = await loadUserKeybindings(dir, logger);
        expect(rules).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to read keybindings file"), expect.anything());
    });

    it("skips non-object rules and keeps valid ones", async () => {
        const logger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), isEnabled: () => true };
        const file = write(`[
            42,
            "not-an-object",
            null,
            { "key": "ctrl+x", "command": "cut" }
        ]`);
        const rules = await loadUserKeybindings(file, logger);
        expect(rules).toEqual([{ key: "ctrl+x", command: "cut", when: undefined, args: undefined }]);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Skipping non-object keybinding rule"));
    });
});
