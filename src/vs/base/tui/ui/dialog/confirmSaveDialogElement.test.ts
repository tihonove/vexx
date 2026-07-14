import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../../tui/backend/mockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../../common/geometry.ts";
import { DEFAULT_COLOR, packRgb } from "../../../common/color.ts";
import { TerminalScreen } from "../../../../tui/rendering/terminalScreen.ts";
import { ROOT_RESOLVED_STYLE } from "../../styles/tuiStyle.ts";
import { RenderContext } from "../../tuiElement.ts";

import { ConfirmSaveDialogElement } from "./confirmSaveDialogElement.tsx";

const BG = packRgb(37, 37, 38);

function renderDialog(filename: string): MockTerminalBackend {
    const dialog = new ConfirmSaveDialogElement(filename);
    const w = dialog.getMaxIntrinsicWidth(0);
    const h = dialog.getMaxIntrinsicHeight(w);
    const size = new Size(w, h);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    dialog.globalPosition = new Point(0, 0);
    dialog.performStyleResolution(ROOT_RESOLVED_STYLE);
    dialog.performLayout(BoxConstraints.tight(size));
    dialog.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("ConfirmSaveDialogElement", () => {
    it("padding cells use dialog background color, not transparent", () => {
        const backend = renderDialog("test.ts");

        // BoxContainer border at x=0, inner content starts at x=1.
        // BoxContainer header: title row (y=1) + separator (y=2) → paddingTop=3.
        // PaddingContainer has left=2, so padding occupies x=1 and x=2 of the dialog.
        // First content row at y=3.
        const leftPad0 = new Point(1, 3);
        const leftPad1 = new Point(2, 3);

        expect(backend.getBgAt(leftPad0)).toBe(BG);
        expect(backend.getBgAt(leftPad0)).not.toBe(DEFAULT_COLOR);
        expect(backend.getBgAt(leftPad1)).toBe(BG);
        expect(backend.getBgAt(leftPad1)).not.toBe(DEFAULT_COLOR);
    });
});
