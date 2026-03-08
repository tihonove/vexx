import { describe, it, expect, vi } from "vitest";
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

    it("second flush with same content skips setCellAt entirely", () => {
        const backend = new MockTerminalBackend(5, 3);
        const screen = new TerminalScreen(5, 3);
        screen.setCell(0, 0, { char: "A" });
        screen.setCell(1, 0, { char: "B" });

        // First flush — writes everything
        screen.flush(backend);

        const spy = vi.spyOn(backend, "setCellAt");

        // Second flush with identical content — should write nothing
        screen.clear();
        screen.setCell(0, 0, { char: "A" });
        screen.setCell(1, 0, { char: "B" });
        screen.flush(backend);

        expect(spy).not.toHaveBeenCalled();
    });

    it("second flush sends only changed cells", () => {
        const backend = new MockTerminalBackend(5, 3);
        const screen = new TerminalScreen(5, 3);
        screen.setCell(0, 0, { char: "A" });
        screen.setCell(1, 0, { char: "B" });
        screen.setCell(2, 0, { char: "C" });
        screen.flush(backend);

        const spy = vi.spyOn(backend, "setCellAt");

        // Change only cell (1,0) from "B" to "X"
        screen.clear();
        screen.setCell(0, 0, { char: "A" });
        screen.setCell(1, 0, { char: "X" });
        screen.setCell(2, 0, { char: "C" });
        screen.flush(backend);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(1, 0, "X");
        expect(backend.getTextAt(0, 0, 3)).toBe("AXC");
    });
});
