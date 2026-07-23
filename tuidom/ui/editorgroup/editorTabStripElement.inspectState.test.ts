import { describe, expect, it } from "vitest";

import type { TabInfo } from "./editorTabStripElement.ts";
import { EditorTabStripElement } from "./editorTabStripElement.ts";

function tab(label: string, over: Partial<TabInfo> = {}): TabInfo {
    return { label, icon: "", iconColor: 0, isModified: false, isReadOnly: false, ...over };
}

describe("EditorTabStripElement.inspectState", () => {
    it("reports tab labels with active/modified/readonly flags", () => {
        const strip = new EditorTabStripElement();
        strip.setTabs([tab("a.ts", { isModified: true }), tab("b.log", { isReadOnly: true })]);
        strip.activeIndex = 1;

        expect(strip.inspectState()).toEqual({
            activeIndex: 1,
            tabs: [
                { label: "a.ts", active: false, modified: true, readOnly: false },
                { label: "b.log", active: true, modified: false, readOnly: true },
            ],
        });
    });
});
