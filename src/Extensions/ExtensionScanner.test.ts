import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanBuiltinExtensions } from "./ExtensionScanner.ts";

describe("scanBuiltinExtensions", () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vexx-ext-scan-"));
    });

    afterEach(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    async function writeManifest(name: string, manifest: object): Promise<void> {
        const dir = path.join(tempDir, name);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(path.join(dir, "package.json"), JSON.stringify(manifest));
    }

    it("читает валидный манифест и формирует id из publisher.name", async () => {
        await writeManifest("ts-basics", {
            name: "typescript",
            publisher: "vscode",
            version: "10.0.0",
        });

        const result = await scanBuiltinExtensions(tempDir);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("vscode.typescript");
        expect(result[0].location).toBe(path.join(tempDir, "ts-basics"));
        expect(result[0].isBuiltin).toBe(true);
    });

    it("пропускает каталоги без package.json", async () => {
        await fs.promises.mkdir(path.join(tempDir, "empty"));
        const result = await scanBuiltinExtensions(tempDir);
        expect(result).toEqual([]);
    });

    it("пропускает манифест с невалидным JSON", async () => {
        const dir = path.join(tempDir, "broken");
        await fs.promises.mkdir(dir);
        await fs.promises.writeFile(path.join(dir, "package.json"), "{not json");

        const result = await scanBuiltinExtensions(tempDir);
        expect(result).toEqual([]);
    });

    it.each([
        ["name", { publisher: "p", version: "1.0.0" }],
        ["publisher", { name: "n", version: "1.0.0" }],
        ["version", { name: "n", publisher: "p" }],
    ])("пропускает манифест без поля %s", async (_field, manifest) => {
        await writeManifest("ext", manifest);
        const result = await scanBuiltinExtensions(tempDir);
        expect(result).toEqual([]);
    });

    it("возвращает пустой массив, если корневого каталога нет", async () => {
        const result = await scanBuiltinExtensions(path.join(tempDir, "missing"));
        expect(result).toEqual([]);
    });

    it("сохраняет полный манифест без изменений", async () => {
        const manifest = {
            name: "css",
            publisher: "vscode",
            version: "1.0.0",
            engines: { vscode: "*" },
            contributes: { languages: [{ id: "css", extensions: [".css"] }] },
        };
        await writeManifest("css", manifest);

        const [ext] = await scanBuiltinExtensions(tempDir);
        expect(ext.manifest).toEqual(manifest);
    });
});
