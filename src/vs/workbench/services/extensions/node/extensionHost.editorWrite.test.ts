import { describe, expect, it } from "vitest";

import { createExtensionTestHarness, extensionFixture } from "../../../../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../../../../TestUtils/timing.ts";
import { createSelection } from "../../../../editor/common/core/iSelection.ts";

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

    // Регрессия #194: раньше выделение уезжало в субпроцесс ТОЛЬКО на смене
    // активного редактора, поэтому `activeTextEditor.selection` навсегда залипал
    // на (0,0) и любая команда, читающая его (maptz wrapWithRegion и вся его
    // родня), молча выходила по `sel.isEmpty`. Тест на продюсера: host обязан
    // донести движение каретки.
    it("расширение видит свежее выделение после движения каретки", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld\nagain" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            const editor = harness.group.getActiveEditor()!;

            // Пользователь выделил вторую строку целиком.
            editor.viewState.selections = [createSelection(1, 0, 1, 5)];
            await harness.flushRpc(4);
            await settle();

            expect(await harness.commandRegistry.execute("test.readSelection")).toEqual({
                anchorLine: 1,
                anchorCharacter: 0,
                activeLine: 1,
                activeCharacter: 5,
                count: 1,
                isEmpty: false,
            });
        } finally {
            await harness.dispose();
        }
    });

    it("расширение видит несколько кареток (multi-cursor)", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld\nagain" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            harness.group.getActiveEditor()!.viewState.selections = [
                createSelection(0, 0, 0, 2),
                createSelection(2, 0, 2, 3),
            ];
            await harness.flushRpc(4);
            await settle();

            const seen = (await harness.commandRegistry.execute("test.readSelection")) as { count: number };
            // maptz (и другие) выходят на `selections.length > 1` — значение должно
            // быть честным, а не всегда 1.
            expect(seen.count).toBe(2);
        } finally {
            await harness.dispose();
        }
    });

    // Регрессия #194: расширение, не поймавшее свой промис, роняло весь extension
    // host. Реальный кейс — maptz после wrapWithRegion зовёт отсутствующую у нас
    // editor.action.formatDocument, RPC отклоняется, и Node убивал субпроцесс —
    // вместе со всеми расширениями и их folding-провайдерами.
    it("необработанный reject в расширении не роняет extension host", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "a.txt", content: "hello\nworld" },
            extensions: [extensionFixture("test.editsActiveEditor", "editsActiveEditor.cjs")],
        });
        try {
            await settle();
            expect(await harness.commandRegistry.execute("test.fireAndForgetMissingCommand")).toBe("issued");
            await harness.flushRpc(4);
            await settle();

            // Host жив: следующая команда того же расширения по-прежнему отвечает.
            expect(await harness.commandRegistry.execute("test.visibleCount")).toBe(1);
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
