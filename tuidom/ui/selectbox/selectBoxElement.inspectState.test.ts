import { describe, expect, it } from "vitest";

import { SelectBoxElement } from "./selectBoxElement.ts";

describe("SelectBoxElement.inspectState", () => {
    it("reports options, selected index/text and closed state", () => {
        const select = new SelectBoxElement();
        select.setOptions([{ text: "Bootstrap" }, { text: "Extensions" }, { text: "Keybindings" }], 1);

        expect(select.inspectState()).toEqual({
            open: false,
            selectedIndex: 1,
            selectedText: "Extensions",
            options: ["Bootstrap", "Extensions", "Keybindings"],
        });
    });
});
