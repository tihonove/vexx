import { describe, it, expect } from "vitest";
import { TerminalScreen } from "./TerminalScreen.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";

describe("TerminalScreen", () => {
    it("flush calls setCellAt on backend for each cell", () => {
        const backend = new MockTerminalBackend(5, 3);
        const screen = new TerminalScreen(5, 3);
        screen.setCell(0, 0, { char: "A" });
        screen.setCell(4, 2, { char: "Z" });

        screen.flush(backend);

        expect(backend.getTextAt(0, 0, 1)).toBe("A");
        expect(backend.getTextAt(4, 2, 1)).toBe("Z");
        // Empty cells become spaces
        expect(backend.getTextAt(1, 0, 1)).toBe(" ");
    });

    it("flush writes full screen to backend", () => {
        const backend = new MockTerminalBackend(5, 3);
        const screen = new TerminalScreen(5, 3);
        screen.setCell(0, 0, { char: "H" });
        screen.setCell(1, 0, { char: "i" });

        screen.flush(backend);

        expect(backend.screenToString()).toBe("Hi   \n" + "     \n" + "     ");
    });

    it("clear resets all cells so next flush writes spaces", () => {
        const backend = new MockTerminalBackend(5, 3);
        const screen = new TerminalScreen(5, 3);
        screen.setCell(2, 1, { char: "Q" });
        screen.flush(backend);
        expect(backend.getTextAt(2, 1, 1)).toBe("Q");

        screen.clear();
        backend.clearScreen();
        screen.flush(backend);

        expect(backend.getTextAt(2, 1, 1)).toBe(" ");
    });
});
