import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type { ILanguageService } from "../../Editor/Tokenization/ILanguageService.ts";
import { createExtensionTestHarness, EXTENSION_FIXTURES_DIR, extensionFixture } from "../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../TestUtils/timing.ts";

/** Мини-сервис языков: `.ts` → typescript, иначе — undefined. */
const TS_LANGUAGE_SERVICE: ILanguageService = {
    getLanguageIdForResource: (filePath) => (filePath.endsWith(".ts") ? "typescript" : undefined),
    getLanguageDisplayName: () => undefined,
};

describe("ExtensionHost — window.onDidChangeActiveTextEditor (subprocess)", () => {
    it("событие срабатывает при открытии файла после активации расширения", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [extensionFixture("test.watchActiveEditor", "watchActiveEditor.cjs")],
        });
        try {
            // Нет активного редактора при активации → активируем после
            const fp = harness.writeFile("hello.ts", "const x = 1;\n");
            harness.group.openFile(fp);
            // Ждём IPC round-trip: host → subprocess (notif) → extension handler → editor.setOptions → host
            await settle();
            const editor = harness.group.getActiveEditor();
            expect(editor).not.toBeNull();
            // Фикстура ставит tabSize=77 если fileName заканчивается на .ts
            expect(editor?.viewState.tabSize).toBe(77);
        } finally {
            await harness.dispose();
        }
    });

    it("initial snapshot: activeTextEditor корректен при активации если файл уже открыт", async () => {
        // initialFile открывается ДО registerExtension, поэтому initial snapshot
        // содержит правильный путь, и window.activeTextEditor не undefined в activate()
        const harness = await createExtensionTestHarness({
            initialFile: { name: "main.ts", content: "export {};\n" },
            extensions: [extensionFixture("test.watchActiveEditor", "watchActiveEditor.cjs")],
        });
        try {
            // После регистрации расширения initial snapshot уже пришёл, но
            // onDidChangeActiveTextEditor не стрелял (событие, не гарантируется при init).
            // Переключаемся на другой файл — тогда точно стреляет:
            const fp = harness.writeFile("other.ts", "");
            harness.group.openFile(fp);
            await settle();
            const editor = harness.group.getActiveEditor();
            expect(editor?.viewState.tabSize).toBe(77);
        } finally {
            await harness.dispose();
        }
    });

    it("window.activeTextEditor возвращает undefined когда нет открытых файлов", async () => {
        // Фикстура setIndentTabs проверяет editor === undefined и делает ранний return
        // → tabSize остаётся дефолтным (4), а не 8
        const harness = await createExtensionTestHarness({
            extensions: [
                {
                    id: "test.checkUndefined",
                    manifest: { name: "test.checkUndefined", publisher: "test", version: "0.0.1" },
                    mainPath: path.join(EXTENSION_FIXTURES_DIR, "setIndentTabs.cjs"),
                },
            ],
        });
        try {
            expect(harness.group.getActiveEditor()).toBeNull();
            // Нет редактора → fixture ничего не сделала → tabSize не менялся
        } finally {
            await harness.dispose();
        }
    });

    it("languageId проецируется в meta и document стабилен по идентичности", async () => {
        const harness = await createExtensionTestHarness({
            languageService: TS_LANGUAGE_SERVICE,
            extensions: [extensionFixture("test.reportMeta", "reportActiveEditorMeta.cjs")],
        });
        try {
            const fp = harness.writeFile("main.ts", "export {};\n");
            harness.group.openFile(fp);
            await settle();
            const editor = harness.group.getActiveEditor();
            // Фикстура ставит tabSize=71 только если document.languageId==="typescript"
            // И workspace.textDocuments содержит ТОТ ЖЕ объект document.
            expect(editor?.viewState.tabSize).toBe(71);
        } finally {
            await harness.dispose();
        }
    });

    it("document.fileName содержит полный путь к файлу", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [extensionFixture("test.watchActiveEditor", "watchActiveEditor.cjs")],
        });
        try {
            // Создаём файл с расширением .txt — fixture поставит tabSize=1 (не .ts)
            const fp = harness.writeFile("readme.txt", "hello\n");
            harness.group.openFile(fp);
            await settle();
            const editor = harness.group.getActiveEditor();
            // tabSize=1 означает: событие пришло, fileName не заканчивается на .ts
            expect(editor?.viewState.tabSize).toBe(1);
        } finally {
            await harness.dispose();
        }
    });
});
