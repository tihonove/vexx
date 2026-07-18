import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR } from "../../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../../Rendering/TerminalScreen.ts";
import { ThemeService } from "../../../Theme/ThemeService.ts";
import { darkPlusTheme } from "../../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../../Theme/WorkbenchTheme.ts";
import { ROOT_RESOLVED_STYLE } from "../../../TUIDom/Styles/TUIStyle.ts";
import { RenderContext } from "../../../TUIDom/TUIElement.ts";

import { ConfirmSaveDialog } from "./ConfirmSaveDialog.tsx";

const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

function renderDialog(filename: string): MockTerminalBackend {
    const dialog = new ConfirmSaveDialog(new ThemeService(theme), filename);
    const view = dialog.view;
    const w = view.getMaxIntrinsicWidth(0);
    const h = view.getMaxIntrinsicHeight(w);
    const size = new Size(w, h);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    view.globalPosition = new Point(0, 0);
    view.performStyleResolution(ROOT_RESOLVED_STYLE);
    view.performLayout(BoxConstraints.tight(size));
    view.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("ConfirmSaveDialog", () => {
    it("padding cells use the themed dialog background, not transparent", () => {
        const backend = renderDialog("test.ts");
        const bg = theme.getRequiredColor("editorWidget.background");

        // BoxContainer border at x=0, inner content starts at x=1.
        // BoxContainer header: title row (y=1) + separator (y=2) → paddingTop=3.
        // PaddingContainer has left=2, so padding occupies x=1 and x=2 of the dialog.
        // First content row at y=3.
        const leftPad0 = new Point(1, 3);
        const leftPad1 = new Point(2, 3);

        expect(backend.getBgAt(leftPad0)).toBe(bg);
        expect(backend.getBgAt(leftPad0)).not.toBe(DEFAULT_COLOR);
        expect(backend.getBgAt(leftPad1)).toBe(bg);
        expect(backend.getBgAt(leftPad1)).not.toBe(DEFAULT_COLOR);
    });
});
