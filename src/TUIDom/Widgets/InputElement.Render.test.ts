import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { InputElement } from "./InputElement.ts";
import { InputState } from "./InputState.ts";

function renderInput(input: InputElement, width: number): { backend: MockTerminalBackend; termScreen: TerminalScreen } {
    const height = input.showBorder ? 3 : 1;
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    input.globalPosition = new Point(0, 0);
    input.performLayout(BoxConstraints.tight(size));

    const clip = new Rect(new Point(0, 0), size);
    input.render(new RenderContext(termScreen, new Offset(0, 0), clip));
    termScreen.flush(backend);
    return { backend, termScreen };
}

describe("InputElement — layout", () => {
    it("has height 1 without border", () => {
        const input = new InputElement();
        input.performLayout(BoxConstraints.tight(new Size(20, 1)));
        expect(input.layoutSize.height).toBe(1);
    });

    it("has height 3 with border", () => {
        const input = new InputElement();
        input.showBorder = true;
        input.performLayout(BoxConstraints.tight(new Size(20, 3)));
        expect(input.layoutSize.height).toBe(3);
    });

    it("takes the given width", () => {
        const input = new InputElement();
        input.performLayout(BoxConstraints.tight(new Size(30, 1)));
        expect(input.layoutSize.width).toBe(30);
    });

    it("returns correct minIntrinsicHeight", () => {
        const input = new InputElement();
        expect(input.getMinIntrinsicHeight(20)).toBe(1);
        input.showBorder = true;
        expect(input.getMinIntrinsicHeight(20)).toBe(3);
    });

    it("returns correct maxIntrinsicHeight", () => {
        const input = new InputElement();
        expect(input.getMaxIntrinsicHeight(20)).toBe(1);
        input.showBorder = true;
        expect(input.getMaxIntrinsicHeight(20)).toBe(3);
    });
});

describe("InputElement — rendering without border", () => {
    it("renders text at row 0", () => {
        const input = new InputElement();
        input.inputState.value = "hello";
        const { backend } = renderInput(input, 20);
        const row = backend.getTextAt(new Point(0, 0), 20);
        expect(row).toContain("hello");
    });

    it("renders text from column 0", () => {
        const input = new InputElement();
        input.inputState.value = "abc";
        const { backend } = renderInput(input, 20);
        const row = backend.getTextAt(new Point(0, 0), 3);
        expect(row).toBe("abc");
    });

    it("renders placeholder when text is empty", () => {
        const input = new InputElement();
        input.placeholder = "Search…";
        const { backend } = renderInput(input, 20);
        const row = backend.getTextAt(new Point(0, 0), 20);
        expect(row).toContain("Search");
    });

    it("does not show placeholder when text is present", () => {
        const input = new InputElement();
        input.placeholder = "Search…";
        input.inputState.value = "hello";
        const { backend } = renderInput(input, 20);
        const row = backend.getTextAt(new Point(0, 0), 20);
        expect(row).toContain("hello");
        expect(row).not.toContain("Search");
    });

    it("renders empty when text is empty and no placeholder", () => {
        const input = new InputElement();
        const { backend } = renderInput(input, 10);
        const row = backend.getTextAt(new Point(0, 0), 10);
        expect(row.trim()).toBe("");
    });
});

describe("InputElement — rendering with border", () => {
    it("renders top-left corner ┌", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("┌");
    });

    it("renders top-right corner ┐", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(9, 0), 1)).toBe("┐");
    });

    it("renders bottom-left corner └", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(0, 2), 1)).toBe("└");
    });

    it("renders bottom-right corner ┘", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(9, 2), 1)).toBe("┘");
    });

    it("renders left side border │", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(0, 1), 1)).toBe("│");
    });

    it("renders right side border │", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 10);
        expect(backend.getTextAt(new Point(9, 1), 1)).toBe("│");
    });

    it("renders text on row 1 (inside border)", () => {
        const input = new InputElement();
        input.showBorder = true;
        input.inputState.value = "hello";
        const { backend } = renderInput(input, 15);
        const innerRow = backend.getTextAt(new Point(1, 1), 13);
        expect(innerRow).toContain("hello");
    });

    it("renders placeholder on row 1 when empty", () => {
        const input = new InputElement();
        input.showBorder = true;
        input.placeholder = "Type here";
        const { backend } = renderInput(input, 20);
        const innerRow = backend.getTextAt(new Point(1, 1), 18);
        expect(innerRow).toContain("Type here");
    });

    it("top border uses ─ between corners", () => {
        const input = new InputElement();
        input.showBorder = true;
        const { backend } = renderInput(input, 6);
        // columns 1..4 should be ─
        const topMid = backend.getTextAt(new Point(1, 0), 4);
        expect(topMid).toBe("────");
    });
});

describe("InputElement — horizontal scroll", () => {
    it("shows end of text when cursor is at end of long text", () => {
        const state = new InputState();
        state.value = "AAABBBCCC"; // cursor at end
        const input = new InputElement(state);
        const { backend } = renderInput(input, 6); // width=6, text=9 chars
        // Cursor is at offset 9, scrollX should be >= 4 to show cursor
        // Row should show last part of text, not the beginning "AAA"
        const row = backend.getTextAt(new Point(0, 0), 6);
        expect(row).toContain("C");
        expect(row).not.toBe("AAABBB");
    });

    it("shows beginning when cursor is at start", () => {
        const state = new InputState();
        state.value = "AAABBBCCC";
        state.moveCursorToStart();
        const input = new InputElement(state);
        const { backend } = renderInput(input, 6);
        const row = backend.getTextAt(new Point(0, 0), 6);
        expect(row).toContain("A");
    });
});

describe("InputElement — cursor position", () => {
    it("sets cursor position when input is rendered with isFocused via termScreen", () => {
        // Without a FocusManager, isFocused is always false and cursor is not set.
        // This test verifies that cursorPosition remains null when not focused.
        const input = new InputElement();
        input.inputState.value = "hi";
        const { termScreen } = renderInput(input, 20);
        // Not focused → no cursor set
        expect(termScreen.cursorPosition).toBeNull();
    });
});
