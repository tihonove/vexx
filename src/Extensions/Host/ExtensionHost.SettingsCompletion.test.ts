import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createExtensionTestHarness } from "../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../TestUtils/timing.ts";

import type { IExtensionRegistration } from "./IExtensionEntry.ts";

// Грузим настоящий builtin `vexx-settings` по mainPath (subprocess тестов —
// tsx, транспилирует `.ts`-main и вшитый `settings-schema.generated.ts`).
const VEXX_SETTINGS_MAIN = fileURLToPath(new URL("../builtin/vexx-settings/main.ts", import.meta.url));

function settingsExtension(): IExtensionRegistration {
    return {
        id: "vexx.settings",
        manifest: { name: "settings", publisher: "vexx", version: "0.1.0" },
        mainPath: VEXX_SETTINGS_MAIN,
        activationEvents: ["onLanguage:json"],
    };
}

const SETTINGS_REQ = {
    fileName: "/proj/.vexx/settings.json",
    languageId: "json",
    text: "",
    line: 0,
    character: 0,
};

describe("vexx-settings — автодополнение ключей в settings.json", () => {
    it("активируется onLanguage:json и предлагает известные ключи настроек", async () => {
        const harness = await createExtensionTestHarness({
            activateEvents: [], // управляем активацией вручную — проверяем лениость
            extensions: [settingsExtension()],
        });
        try {
            // Пока событие языка не наступило — расширение не активно.
            expect(harness.host.hasExtension("vexx.settings")).toBe(false);

            await harness.host.activateByEvent("onLanguage:json");
            await settle();
            expect(harness.host.hasExtension("vexx.settings")).toBe(true);

            const items = await harness.group.completionSource!(SETTINGS_REQ);
            const labels = items.map((i) => i.label);
            // Ключи из app-дефолтов и из contributes.configuration builtin'ов.
            expect(labels).toContain("editor.tabSize");
            expect(labels).toContain("workbench.colorTheme");
            expect(labels).toContain("git.enabled");

            // Rich-метаданные из схемы доезжают до элемента.
            const gitEnabled = items.find((i) => i.label === "git.enabled");
            expect(gitEnabled?.detail).toContain("boolean");
            expect(gitEnabled?.documentation).toBe("Master switch for the built-in Git integration.");
        } finally {
            await harness.dispose();
        }
    });

    it("для не-settings JSON селектор не срабатывает → []", async () => {
        const harness = await createExtensionTestHarness({
            activateEvents: [],
            extensions: [settingsExtension()],
        });
        try {
            await harness.host.activateByEvent("onLanguage:json");
            await settle();
            const items = await harness.host.provideCompletionItems({ ...SETTINGS_REQ, fileName: "/proj/other.json" });
            expect(items).toEqual([]);
        } finally {
            await harness.dispose();
        }
    });
});
