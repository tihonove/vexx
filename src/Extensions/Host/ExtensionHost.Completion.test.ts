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

const REQ = {
    fileName: "/proj/.editorconfig",
    languageId: "editorconfig",
    text: "ind",
    line: 0,
    character: 3,
};

describe("ExtensionHost — completion bridge (subprocess)", () => {
    it("provideCompletionItems возвращает элементы провайдера, item.command исполняется через bridge", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: ".editorconfig", content: "ind" },
            extensions: [reg("test.providesCompletion", "providesCompletion.cjs")],
        });
        try {
            await settle();

            const items = await harness.host.provideCompletionItems(REQ);
            expect(items.map((i) => i.label)).toEqual(["indent_style", "indent_size"]);

            const style = items.find((i) => i.label === "indent_style");
            expect(style?.insertText).toBe("indent_style"); // fallback на label
            expect(style?.detail).toBe("EditorConfig");
            expect(style?.command?.command).toBe("editorconfig._triggerSuggestAfterDelay");

            // item.command доезжает через commands bridge и правит активный редактор.
            expect(harness.commandRegistry.has("editorconfig._triggerSuggestAfterDelay")).toBe(true);
            await harness.commandRegistry.execute(style!.command!.command);
            await settle();
            expect(harness.group.getActiveEditor()?.viewState.tabSize).toBe(6);
        } finally {
            await harness.dispose();
        }
    });

    it("селектор другого языка → пустой результат", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: ".editorconfig", content: "ind" },
            extensions: [reg("test.providesCompletion", "providesCompletion.cjs")],
        });
        try {
            await settle();
            const items = await harness.host.provideCompletionItems({ ...REQ, languageId: "typescript" });
            expect(items).toEqual([]);
        } finally {
            await harness.dispose();
        }
    });

    it("без completion-провайдеров (нет расширений) → [] без RPC", async () => {
        const harness = await createExtensionTestHarness({
            initialFile: { name: "main.ts", content: "x\n" },
        });
        try {
            const items = await harness.host.provideCompletionItems({
                fileName: "/proj/main.ts",
                languageId: "typescript",
                text: "x",
                line: 0,
                character: 1,
            });
            expect(items).toEqual([]);
        } finally {
            await harness.dispose();
        }
    });
});
