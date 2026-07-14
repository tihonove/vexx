import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../../../../base/common/geometry.ts";
import type { MouseToken } from "../../../../tui/input/rawTerminalToken.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";

import { FileTreeController } from "./fileTreeController.ts";

function makeMove(x: number, y: number): MouseToken {
    return {
        kind: "mouse",
        button: "none",
        x,
        y,
        action: "move",
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        raw: "",
    };
}

// The explorer is drawn inside a TitledPanelElement (title on the first row) with
// a one-column left padding, so the first file row sits at screen y=1, the second
// at y=2, and so on. Mouse tokens are 1-based, hence token.y = screenY + 1.
const SECOND_ROW_SCREEN_Y = 2;

describe("FileTreeController hover", () => {
    let ws: ITempWorkspace;
    let controller: FileTreeController;
    let app: TestApp;
    let theme: WorkbenchTheme;

    beforeEach(async () => {
        ws = createTempWorkspace({ prefix: "vexx-hover-", files: { "aaa.ts": "", "bbb.ts": "", "ccc.ts": "" } });
        theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        controller = new FileTreeController(new ThemeService(theme));
        controller.setRootPath(ws.dir);
        controller.mount();
        app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        app.render();
    });

    afterEach(() => {
        controller.dispose();
        ws.dispose();
    });

    it("highlights the row under the cursor with list.hoverBackground on mouse move", () => {
        const hoverBg = theme.getColor("list.hoverBackground");
        // Hover the second row (the first row is the cursor row, which takes priority).
        app.backend.simulateMouse(makeMove(4, SECOND_ROW_SCREEN_Y + 1));
        app.render();

        const bg = app.backend.getBgAt(new Point(2, SECOND_ROW_SCREEN_Y));
        expect(bg).toBe(hoverBg);
    });

    it("hover is visibly distinct from the normal sidebar row background", () => {
        // Guards against a regression where sideBar.background and list.hoverBackground
        // sit so close together that the hover highlight is imperceptible (issue #93).
        const hoverBg = theme.getColor("list.hoverBackground");
        const sidebarBg = theme.getColor("sideBar.background");
        expect(hoverBg).not.toBeUndefined();
        expect(sidebarBg).not.toBeUndefined();
        expect(hoverBg).not.toBe(sidebarBg);

        // A non-hovered, non-cursor row keeps the plain sidebar background...
        const plainBg = app.backend.getBgAt(new Point(2, SECOND_ROW_SCREEN_Y));
        expect(plainBg).toBe(sidebarBg);

        // ...and turns into the hover background once the mouse is over it.
        app.backend.simulateMouse(makeMove(4, SECOND_ROW_SCREEN_Y + 1));
        app.render();
        const hoveredBg = app.backend.getBgAt(new Point(2, SECOND_ROW_SCREEN_Y));
        expect(hoveredBg).toBe(hoverBg);
        expect(hoveredBg).not.toBe(plainBg);
    });

    it("does not move the selection cursor when hovering (hover is focus-independent)", () => {
        // The cursor starts on the first row. Hovering another row must not move it.
        app.backend.simulateMouse(makeMove(4, SECOND_ROW_SCREEN_Y + 1));
        app.render();

        // The first row still carries the selection background (inactive, tree unfocused),
        // proving the hover did not steal the cursor.
        const cursorBg = app.backend.getBgAt(new Point(2, 1));
        expect(cursorBg).toBe(theme.getColor("list.inactiveSelectionBackground"));
    });

    it("clears the hover highlight once the mouse leaves the row", () => {
        const sidebarBg = theme.getColor("sideBar.background");
        app.backend.simulateMouse(makeMove(4, SECOND_ROW_SCREEN_Y + 1));
        app.render();
        expect(app.backend.getBgAt(new Point(2, SECOND_ROW_SCREEN_Y))).toBe(theme.getColor("list.hoverBackground"));

        // Move the mouse below the last row (empty area) — the row reverts to plain bg.
        app.backend.simulateMouse(makeMove(4, 9));
        app.render();
        expect(app.backend.getBgAt(new Point(2, SECOND_ROW_SCREEN_Y))).toBe(sidebarBg);
    });
});
