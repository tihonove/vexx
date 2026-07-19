import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../backend/mockTerminalBackend.ts";
import { Point, Size } from "../../base/common/geometryPromitives.ts";

import { TerminalScreen } from "./terminalScreen.ts";

describe("TerminalScreen", () => {
    it("flush writes cells to backend", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        const screen = new TerminalScreen(new Size(5, 3));
        screen.setCell(new Point(0, 0), { char: "A" });
        screen.setCell(new Point(4, 2), { char: "Z" });

        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("A");
        expect(backend.getTextAt(new Point(4, 2), 1)).toBe("Z");
        // Empty cells become spaces
        expect(backend.getTextAt(new Point(1, 0), 1)).toBe(" ");
    });

    it("flush writes full screen to backend", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        const screen = new TerminalScreen(new Size(5, 3));
        screen.setCell(new Point(0, 0), { char: "H" });
        screen.setCell(new Point(1, 0), { char: "i" });

        screen.flush(backend);

        expect(backend.screenToString()).toBe("Hi   \n" + "     \n" + "     ");
    });

    it("clear resets all cells so next flush writes spaces", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        const screen = new TerminalScreen(new Size(5, 3));
        screen.setCell(new Point(2, 1), { char: "Q" });
        screen.flush(backend);
        expect(backend.getTextAt(new Point(2, 1), 1)).toBe("Q");

        screen.clear();
        screen.flush(backend);

        expect(backend.getTextAt(new Point(2, 1), 1)).toBe(" ");
    });

    describe("cursor position", () => {
        it("is null by default", () => {
            const screen = new TerminalScreen(new Size(5, 3));
            expect(screen.cursorPosition).toBeNull();
        });

        it("setCursorPosition stores the position", () => {
            const screen = new TerminalScreen(new Size(5, 3));
            screen.setCursorPosition(new Point(2, 1));
            expect(screen.cursorPosition).toEqual(new Point(2, 1));
        });

        it("clearCursorPosition resets it to null (line 31)", () => {
            const screen = new TerminalScreen(new Size(5, 3));
            screen.setCursorPosition(new Point(3, 2));
            expect(screen.cursorPosition).not.toBeNull();

            screen.clearCursorPosition();
            expect(screen.cursorPosition).toBeNull();
        });

        it("clear() also drops the cursor position", () => {
            const screen = new TerminalScreen(new Size(5, 3));
            screen.setCursorPosition(new Point(1, 1));
            screen.clear();
            expect(screen.cursorPosition).toBeNull();
        });
    });
});
