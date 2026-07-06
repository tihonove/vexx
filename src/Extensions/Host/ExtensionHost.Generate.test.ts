import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createExtensionTestHarness } from "../../TestUtils/ExtensionTestHarness.ts";

const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url)) + "/__fixtures__";

function reg(id: string, file: string) {
    return {
        id,
        manifest: { name: id, publisher: "test", version: "0.0.1" },
        mainPath: path.join(FIXTURES_DIR, file),
    };
}

describe("ExtensionHost — EditorConfig.generate (workspace.fs, WP7)", () => {
    it("executeCommand создаёт .editorconfig в workspace-папке через workspace.fs", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [reg("test.editorconfig", "generateEditorConfig.cjs")],
        });
        try {
            const target = path.join(harness.tmpDir, ".editorconfig");
            expect(fs.existsSync(target)).toBe(false);

            // Полная цепочка: host CommandRegistry → RPC → сабпроцесс →
            // workspace.fs.writeFile (node:fs, локально).
            const result = await harness.commandRegistry.execute("EditorConfig.generate");
            expect(result).toBe("generated");

            expect(fs.existsSync(target)).toBe(true);
            const content = fs.readFileSync(target, "utf8");
            expect(content).toContain("root = true");
            expect(content).toContain("indent_style = space");
        } finally {
            await harness.dispose();
        }
    });

    it("повторный вызов идемпотентен: stat находит файл, перезаписи нет", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [reg("test.editorconfig", "generateEditorConfig.cjs")],
        });
        try {
            const target = path.join(harness.tmpDir, ".editorconfig");
            expect(await harness.commandRegistry.execute("EditorConfig.generate")).toBe("generated");
            // Помечаем файл, чтобы поймать перезапись.
            fs.appendFileSync(target, "# sentinel\n");

            expect(await harness.commandRegistry.execute("EditorConfig.generate")).toBe("exists");
            expect(fs.readFileSync(target, "utf8")).toContain("# sentinel");
        } finally {
            await harness.dispose();
        }
    });
});
