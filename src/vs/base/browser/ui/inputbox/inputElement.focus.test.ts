import { describe, expect, it } from "vitest";

import { Point, Size } from "../../../common/geometryPromitives.ts";
import { packRgb } from "../../../common/colorUtils.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";

import { InputElement } from "./inputElement.ts";

// `isFocused` is only true when the element is wired into a tree with a
// FocusManager that holds it as the active element — so these go through
// TestApp rather than the bare RenderContext helper used in the other suites.

const FOCUSED_BORDER_FG = packRgb(0x00, 0x7f, 0xd4); // #007FD4
const UNFOCUSED_BORDER_FG = packRgb(0x3c, 0x3c, 0x3c); // #3C3C3C

describe("InputElement — focused rendering", () => {
    it("places the hardware cursor at the caret column when focused (lines 127-130)", () => {
        const input = new InputElement();
        input.inputState.value = "hi"; // caret at offset 2 → column 2
        const app = TestApp.createWithContent(input, new Size(20, 1));

        input.focus();
        app.render();

        expect(app.backend.cursorPosition).toEqual(new Point(2, 0));
    });

    it("uses the focus border colour while focused (line 173 true branch)", () => {
        const input = new InputElement();
        input.showBorder = true;
        const app = TestApp.createWithContent(input, new Size(20, 3));

        input.focus();
        app.render();

        expect(app.backend.getFgAt(new Point(0, 0))).toBe(FOCUSED_BORDER_FG);
    });

    it("reverts to the unfocused border colour after blur", () => {
        const input = new InputElement();
        input.showBorder = true;
        const app = TestApp.createWithContent(input, new Size(20, 3));

        input.focus();
        input.blur();
        app.render();

        expect(app.backend.getFgAt(new Point(0, 0))).toBe(UNFOCUSED_BORDER_FG);
    });
});
