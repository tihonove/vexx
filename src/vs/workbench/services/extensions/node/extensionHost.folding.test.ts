import { describe, expect, it } from "vitest";

import { createExtensionTestHarness, extensionFixture } from "../../../../../TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../../../../TestUtils/timing.ts";
import { Uri } from "../../../../base/common/uri.ts";

const CSHARP_TEXT = ["/* #region A */", "int a;", "int b;", "/* #endregion */", "int c;"].join("\n");

const REQ = {
    uri: Uri.file("/proj/Program.cs").toString(),
    languageId: "csharp",
    text: CSHARP_TEXT,
};

describe("ExtensionHost — folding bridge (subprocess)", () => {
    it("provideFoldingRanges возвращает регионы провайдера", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [extensionFixture("test.providesFolding", "providesFolding.cjs")],
        });
        try {
            await settle();
            // Через group.foldingRangeSource (wiring харнесса) — как это делает ядро.
            const regions = await harness.group.foldingRangeSource!(REQ);
            expect(regions).toEqual([{ startLine: 0, endLine: 3, isCollapsed: false }]);
        } finally {
            await harness.dispose();
        }
    });

    it("селектор другого языка → пустой результат", async () => {
        const harness = await createExtensionTestHarness({
            extensions: [extensionFixture("test.providesFolding", "providesFolding.cjs")],
        });
        try {
            await settle();
            const regions = await harness.host.provideFoldingRanges({ ...REQ, languageId: "typescript" });
            expect(regions).toEqual([]);
        } finally {
            await harness.dispose();
        }
    });

    it("без folding-провайдеров (нет расширений) → [] без RPC", async () => {
        const harness = await createExtensionTestHarness({});
        try {
            const regions = await harness.host.provideFoldingRanges(REQ);
            expect(regions).toEqual([]);
        } finally {
            await harness.dispose();
        }
    });
});
