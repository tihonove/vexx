import { describe, expect, it } from "vitest";

import { createExtensionTestHarness, extensionFixture } from "../../TestUtils/ExtensionTestHarness.ts";

describe("ExtensionHost — indent options API (subprocess)", () => {
    it("расширение проставляет 2-space indent через editor.options", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "hello.ts", content: "const x = 1;\n" },
            extensions: [extensionFixture("test.setIndentSpaces", "setIndentSpaces.cjs")],
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
            extensions: [extensionFixture("test.setIndentTabs", "setIndentTabs.cjs")],
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
            extensions: [extensionFixture("test.setIndentSpaces", "setIndentSpaces.cjs")],
        });
        try {
            expect(harness.group.getActiveEditor()).toBeNull();
            expect(harness.host.extensionCount).toBe(1);
        } finally {
            await harness.dispose();
        }
    });
});
