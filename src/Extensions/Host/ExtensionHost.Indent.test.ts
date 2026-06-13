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

describe("ExtensionHost — indent options API (subprocess)", () => {
    it("расширение проставляет 2-space indent через editor.options", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "hello.ts", content: "const x = 1;\n" },
            extensions: [reg("test.setIndentSpaces", "setIndentSpaces.cjs")],
        });
        try {
            const editor = harness.group.getActiveEditor();
            expect(editor).not.toBeNull();
            expect(editor?.viewState.tabSize).toBe(2);
            expect(editor?.viewState.insertSpaces).toBe(true);
        } finally {
            await harness.dispose();
        }
    });

    it("расширение проставляет 8-tab indent через editor.options", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "hello.ts", content: "const x = 1;\n" },
            extensions: [reg("test.setIndentTabs", "setIndentTabs.cjs")],
        });
        try {
            const editor = harness.group.getActiveEditor();
            expect(editor?.viewState.tabSize).toBe(8);
            expect(editor?.viewState.insertSpaces).toBe(false);
        } finally {
            await harness.dispose();
        }
    });

    it("без активного редактора расширение не падает", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [reg("test.setIndentSpaces", "setIndentSpaces.cjs")],
        });
        try {
            expect(harness.group.getActiveEditor()).toBeNull();
            expect(harness.host.extensionCount).toBe(1);
        } finally {
            await harness.dispose();
        }
    });
});
