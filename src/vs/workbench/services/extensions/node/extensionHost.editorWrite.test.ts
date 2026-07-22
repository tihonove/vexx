import { describe, expect, it } from "vitest";

import { createExtensionTestHarness, extensionFixture } from "../../../../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../../../../TestUtils/timing.ts";

describe("ExtensionHost — editor write API (subprocess)", () => {
    it("editor.edit(insert) применяет правку к активному редактору (undoable)", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            const applied = await harness.commandRegistry.execute("test.insertX");
            await settle();
            expect(applied).toBe(true);
            expect(harness.group.getActiveEditor()?.getText()).toBe("Xhello\nworld");

            // Правка undoable — откатывается штатным undo редактора.
            harness.group.getActiveEditor()?.undo();
            expect(harness.group.getActiveEditor()?.getText()).toBe("hello\nworld");
        } finally {
            await harness.dispose();
        }
    });

    it("editor.selection = ... выставляет выделение активного редактора", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            await harness.commandRegistry.execute("test.selectFirstLine");
            await settle();
            const sel = harness.group.getActiveEditor()?.viewState.selections[0];
            expect(sel?.anchor).toEqual({ line: 0, character: 0 });
            expect(sel?.active).toEqual({ line: 0, character: 3 });
        } finally {
            await harness.dispose();
        }
    });

    it("editor.edit(delete) удаляет диапазон", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            const applied = await harness.commandRegistry.execute("test.deleteFirstLine");
            await settle();
            expect(applied).toBe(true);
            expect(harness.group.getActiveEditor()?.getText()).toBe("world");
        } finally {
            await harness.dispose();
        }
    });

    it("window.visibleTextEditors содержит активный редактор", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            const count = await harness.commandRegistry.execute("test.visibleCount");
            expect(count).toBe(1);
        } finally {
            await harness.dispose();
        }
    });
});
