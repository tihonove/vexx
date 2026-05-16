import { describe, expect, it } from "vitest";

import { createExtensionTestHarness } from "../../TestUtils/ExtensionTestHarness.ts";

import { setIndentSpacesExtension } from "./__fixtures__/setIndentSpaces.ts";
import { setIndentTabsExtension } from "./__fixtures__/setIndentTabs.ts";

describe("ExtensionHost — indent options API", () => {
    it("расширение проставляет 2-space indent через editor.options", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "hello.ts", content: "const x = 1;\n" },
            extensions: [
                {
                    id: "test.setIndentSpaces",
                    manifest: { name: "set-indent-spaces", publisher: "test", version: "0.0.1" },
                    entry: setIndentSpacesExtension,
                },
            ],
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
            extensions: [
                {
                    id: "test.setIndentTabs",
                    manifest: { name: "set-indent-tabs", publisher: "test", version: "0.0.1" },
                    entry: setIndentTabsExtension,
                },
            ],
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
            extensions: [
                {
                    id: "test.setIndentSpaces",
                    manifest: { name: "set-indent-spaces", publisher: "test", version: "0.0.1" },
                    entry: setIndentSpacesExtension,
                },
            ],
        });
        try {
            expect(harness.group.getActiveEditor()).toBeNull();
            expect(harness.host.extensionCount).toBe(1);
        } finally {
            await harness.dispose();
        }
    });
});
