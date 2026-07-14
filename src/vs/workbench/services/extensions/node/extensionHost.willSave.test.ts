import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createDeleteEdit } from "../../../../editor/common/core/textEdit.ts";
import { createExtensionTestHarness, extensionFixture } from "../../../../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../../../../TestUtils/timing.ts";

describe("ExtensionHost — onWillSaveTextDocument (save pipeline)", () => {
    it("применяет trim/insert-final-newline из участника к байтам на диске + undoable", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "trim.txt", content: "alpha   \nbeta\t\ngamma" },
            extensions: [extensionFixture("test.willSaveTrim", "willSaveTrimEdits.cjs")],
        });
        try {
            await settle(); // дать updateSubscriptions долететь до хоста
            const editor = harness.group.getActiveEditor();
            expect(editor).not.toBeNull();

            await editor?.save();

            const fp = path.join(harness.tmpDir, "trim.txt");
            expect(fs.readFileSync(fp, "utf-8")).toBe("alpha\nbeta\ngamma\n");
            // Буфер тоже трансформирован, документ снова «чистый» после записи.
            expect(editor?.getText()).toBe("alpha\nbeta\ngamma\n");
            expect(editor?.isModified).toBe(false);

            // Undo откатывает pre-save правки одним шагом.
            editor?.undo();
            await settle(20);
            expect(editor?.getText()).toBe("alpha   \nbeta\t\ngamma");
        } finally {
            await harness.dispose();
        }
    });

    it("setEndOfLine из участника меняет EOL — байты на диске содержат CRLF", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "eol.txt", content: "a\nb\n" },
            extensions: [extensionFixture("test.willSaveEol", "willSaveSetEol.cjs")],
        });
        try {
            await settle();
            const editor = harness.group.getActiveEditor();
            await editor?.save();

            const fp = path.join(harness.tmpDir, "eol.txt");
            const bytes = fs.readFileSync(fp, "utf-8");
            expect(bytes).toBe("a\r\nb\r\n");
        } finally {
            await harness.dispose();
        }
    });

    it("делегирование встроенной команде во время will-save (вложенный executeCommand)", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "delegate.txt", content: "one  \ntwo\t\n" },
            extensions: [extensionFixture("test.willSaveDelegate", "willSaveDelegatesCommand.cjs")],
        });
        try {
            // Ядро (в проде — WhitespaceActions из WP2) регистрирует встроенную
            // команду; здесь — эквивалент на host CommandRegistry.
            harness.commandRegistry.register("editor.action.trimTrailingWhitespace", () => {
                const editor = harness.group.getActiveEditor();
                if (editor === null) return;
                const lines = editor.getText().split("\n");
                const edits = lines.flatMap((line, i) => {
                    const trimmed = line.replace(/[ \t]+$/, "");
                    return trimmed.length !== line.length ? [createDeleteEdit(i, trimmed.length, i, line.length)] : [];
                });
                editor.applyExternalEdits(edits, "trim");
            });
            await settle();

            const editor = harness.group.getActiveEditor();
            await editor?.save();

            const fp = path.join(harness.tmpDir, "delegate.txt");
            expect(fs.readFileSync(fp, "utf-8")).toBe("one\ntwo\n");
        } finally {
            await harness.dispose();
        }
    });

    it("onDidSaveTextDocument доезжает до расширения после записи", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "post.txt", content: "x\n" },
            extensions: [extensionFixture("test.reportDidSave", "reportDidSave.cjs")],
        });
        try {
            await settle();
            const editor = harness.group.getActiveEditor();
            expect(editor?.viewState.tabSize).not.toBe(42);

            await editor?.save();
            await settle(); // did-save notify → расширение → editor.setOptions round-trip

            expect(editor?.viewState.tabSize).toBe(42);
        } finally {
            await harness.dispose();
        }
    });

    it("без подписки onWillSave сохранение не трансформирует содержимое (гейтинг)", async () => {
        // reportDidSave подписан только на did-save → willSaveSubscribed=false,
        // will-save RPC не идёт, файл пишется как есть.
        const harness = await createExtensionTestHarness({
            initialFile: { name: "plain.txt", content: "keep   \n" },
            extensions: [extensionFixture("test.reportDidSave", "reportDidSave.cjs")],
        });
        try {
            await settle();
            await harness.group.getActiveEditor()?.save();

            const fp = path.join(harness.tmpDir, "plain.txt");
            expect(fs.readFileSync(fp, "utf-8")).toBe("keep   \n");
            // Дать did-save round-trip (расширение ставит editor.options) осесть
            // до teardown — иначе pending subprocess→host запрос ловит dispose.
            await settle();
        } finally {
            await harness.dispose();
        }
    });
});
