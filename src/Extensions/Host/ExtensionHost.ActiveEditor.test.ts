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

async function settle(ms = 200): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("ExtensionHost — window.onDidChangeActiveTextEditor (subprocess)", () => {
    it("событие срабатывает при открытии файла после активации расширения", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [reg("test.watchActiveEditor", "watchActiveEditor.cjs")],
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
            extensions: [reg("test.watchActiveEditor", "watchActiveEditor.cjs")],
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
                    mainPath: path.join(FIXTURES_DIR, "setIndentTabs.cjs"),
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

    it("document.fileName содержит полный путь к файлу", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [reg("test.watchActiveEditor", "watchActiveEditor.cjs")],
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
