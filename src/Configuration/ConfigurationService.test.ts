import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveUserDataPaths } from "../Common/UserDataPaths.ts";

import { ConfigurationModel } from "./ConfigurationModel.ts";
import { ConfigurationService, loadConfiguration } from "./ConfigurationService.ts";

describe("loadConfiguration", () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-cfg-"));
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function paths(profile?: string) {
        return resolveUserDataPaths({ homedir: "/never", userDataDir: tmpRoot, profile });
    }

    function writeSettings(file: string, content: string): void {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }

    it("returns defaults when no settings files exist", async () => {
        const cfg = await loadConfiguration(paths());
        expect(cfg.get<number>("editor.tabSize")).toBe(4);
        expect(cfg.get<boolean>("editor.insertSpaces")).toBe(true);
    });

    it("loads user settings.json (default profile)", async () => {
        const p = paths();
        writeSettings(p.settingsFile, `{ "editor.tabSize": 2 }`);
        const cfg = await loadConfiguration(p);
        expect(cfg.get<number>("editor.tabSize")).toBe(2);
        expect(cfg.get<boolean>("editor.insertSpaces")).toBe(true); // from defaults
    });

    it("supports JSONC: comments and trailing commas", async () => {
        const p = paths();
        writeSettings(
            p.settingsFile,
            `{
                // tab size
                "editor.tabSize": 8,
                "editor.insertSpaces": false, // trailing
            }`,
        );
        const cfg = await loadConfiguration(p);
        expect(cfg.get<number>("editor.tabSize")).toBe(8);
        expect(cfg.get<boolean>("editor.insertSpaces")).toBe(false);
    });

    it("falls back to defaults on broken JSONC", async () => {
        const p = paths();
        writeSettings(p.settingsFile, `{ this is not json`);
        const logger = {
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            isEnabled: () => true,
        };
        const cfg = await loadConfiguration(p, logger);
        expect(cfg.get<number>("editor.tabSize")).toBe(4);
        expect(logger.error).toHaveBeenCalled();
    });

    it("named profile overrides user settings", async () => {
        const defaultPaths = paths();
        writeSettings(defaultPaths.settingsFile, `{ "editor.tabSize": 2 }`);

        const compactPaths = paths("compact");
        writeSettings(compactPaths.settingsFile, `{ "editor.tabSize": 8 }`);

        const cfg = await loadConfiguration(compactPaths);
        expect(cfg.get<number>("editor.tabSize")).toBe(8);
        // user-слой ещё применяется поверх defaults
        expect(cfg.get<boolean>("editor.insertSpaces")).toBe(true);
    });

    it("inspect reports per-layer values", async () => {
        const defaultPaths = paths();
        writeSettings(defaultPaths.settingsFile, `{ "editor.tabSize": 2 }`);

        const compactPaths = paths("compact");
        writeSettings(compactPaths.settingsFile, `{ "editor.tabSize": 8 }`);

        const cfg = await loadConfiguration(compactPaths);
        const ins = cfg.inspect<number>("editor.tabSize");
        expect(ins.default).toBe(4);
        expect(ins.user).toBe(2);
        expect(ins.profile).toBe(8);
        expect(ins.value).toBe(8);
    });

    it("named profile with no file uses user settings", async () => {
        const defaultPaths = paths();
        writeSettings(defaultPaths.settingsFile, `{ "editor.tabSize": 2 }`);

        const cfg = await loadConfiguration(paths("compact"));
        expect(cfg.get<number>("editor.tabSize")).toBe(2);
    });

    it("get returns provided default for unknown keys", async () => {
        const cfg = await loadConfiguration(paths());
        expect(cfg.get<string>("unknown.key", "fallback")).toBe("fallback");
    });

    it("getValue returns nested subtree", async () => {
        const cfg = await loadConfiguration(paths());
        expect(cfg.getValue("editor")).toEqual({ tabSize: 4, insertSpaces: true, cursorSurroundingLines: 3 });
    });

    it("onDidChangeConfiguration returns a disposable no-op subscription", async () => {
        const cfg = await loadConfiguration(paths());
        const sub = cfg.onDidChangeConfiguration(() => {
            /* never fired in this iteration */
        });
        expect(() => {
            sub.dispose();
        }).not.toThrow();
    });

    it("logs and falls back to defaults when a settings file can't be read", async () => {
        const p = paths();
        // Make settings.json a directory → readFile throws EISDIR (not ENOENT),
        // exercising the error branch rather than the missing-file branch.
        fs.mkdirSync(p.settingsFile, { recursive: true });
        const logger = {
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            isEnabled: () => true,
        };
        const cfg = await loadConfiguration(p, logger);
        expect(cfg.get<number>("editor.tabSize")).toBe(4);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed to read settings file"),
            expect.anything(),
        );
    });
});

describe("ConfigurationService.updateUserValue", () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-cfg-write-"));
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function paths(profile?: string) {
        return resolveUserDataPaths({ homedir: "/never", userDataDir: tmpRoot, profile });
    }

    it("writes the key to settings.json when the file did not exist", async () => {
        const p = paths();
        const cfg = await loadConfiguration(p);
        await cfg.updateUserValue?.("workbench.colorTheme", "Monokai");

        const written = fs.readFileSync(p.settingsFile, "utf-8");
        expect(JSON.parse(written)).toEqual({ "workbench.colorTheme": "Monokai" });
        // In-memory model reflects the write immediately (no reload needed).
        expect(cfg.get<string>("workbench.colorTheme")).toBe("Monokai");
    });

    it("preserves existing keys and comments in settings.json", async () => {
        const p = paths();
        fs.mkdirSync(path.dirname(p.settingsFile), { recursive: true });
        fs.writeFileSync(
            p.settingsFile,
            `{
    // keep me
    "editor.tabSize": 2
}
`,
        );
        const cfg = await loadConfiguration(p);
        await cfg.updateUserValue?.("workbench.colorTheme", "Light Modern");

        const written = fs.readFileSync(p.settingsFile, "utf-8");
        expect(written).toContain("// keep me");
        expect(written).toContain(`"editor.tabSize": 2`);
        expect(written).toContain(`"workbench.colorTheme": "Light Modern"`);
        expect(cfg.get<number>("editor.tabSize")).toBe(2);
        expect(cfg.get<string>("workbench.colorTheme")).toBe("Light Modern");
    });

    it("writes to the profile settings file for a named profile", async () => {
        const p = paths("compact");
        const cfg = await loadConfiguration(p);
        await cfg.updateUserValue?.("workbench.colorTheme", "Dark+");

        expect(fs.existsSync(p.settingsFile)).toBe(true);
        expect(JSON.parse(fs.readFileSync(p.settingsFile, "utf-8"))).toEqual({ "workbench.colorTheme": "Dark+" });
        expect(cfg.get<string>("workbench.colorTheme")).toBe("Dark+");
    });

    it("is a no-op when no write target is configured", async () => {
        // Constructed without `writeTargetPath` (e.g. read-only context) → the write
        // is silently skipped and the in-memory value stays unchanged.
        const cfg = new ConfigurationService({
            defaultsLayer: ConfigurationModel.EMPTY,
            userLayer: ConfigurationModel.EMPTY,
            profileLayer: ConfigurationModel.EMPTY,
        });
        await expect(cfg.updateUserValue("workbench.colorTheme", "Monokai")).resolves.toBeUndefined();
        expect(cfg.get<string>("workbench.colorTheme")).toBeUndefined();
    });

    it("rethrows read errors that are not 'file not found'", async () => {
        const p = paths();
        const cfg = await loadConfiguration(p);
        // Make the settings path a directory so reading it fails with EISDIR (not ENOENT).
        fs.mkdirSync(p.settingsFile, { recursive: true });
        await expect(cfg.updateUserValue("workbench.colorTheme", "Monokai")).rejects.toThrow();
    });
});
