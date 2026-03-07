import { describe, it, expect } from "vitest";
import { BodyElement } from "../Elements/BodyElement.ts";
import { TuiApplication } from "../Application/TuiApplication.ts";
import { MockTerminalBackend } from "./MockTerminalBackend.ts";

describe("TuiApplication integration with MockTerminalBackend", () => {
    it("types characters and renders them on screen", () => {
        const backend = new MockTerminalBackend(80, 24);
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        body.addEventListener("keypress", (event) => {
            body.title += event.key;
        });
        app.root = body;
        app.run();

        // Simulate typing "hi"
        backend.sendKey("h");
        backend.sendKey("i");

        // The BodyElement renders title starting at (10, 10)
        expect(backend.getTextAt(0, 0, 2)).toBe("hi");
    });

    it("screenToString contains typed text", () => {
        const backend = new MockTerminalBackend(80, 24);
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        body.addEventListener("keypress", (event) => {
            body.title += event.key;
        });
        app.root = body;
        app.run();

        backend.sendKey("A");
        backend.sendKey("B");
        backend.sendKey("C");

        const screenText = backend.screenToString();
        // Row 10 should contain "ABC" starting at column 10
        const lines = screenText.split("\n");
        expect(lines[0].slice(0, 3)).toBe("ABC");
    });

    it("screen is clean before any input", () => {
        const backend = new MockTerminalBackend(20, 5);
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run();

        // No input yet — backend screen should be all spaces (null cells)
        expect(backend.screenToString()).toBe(Array(5).fill(" ".repeat(20)).join("\n"));
    });

    it("uses custom terminal size from backend", () => {
        const backend = new MockTerminalBackend(120, 40);
        const app = new TuiApplication(backend);

        expect(app.screen.width).toBe(120);
        expect(app.screen.height).toBe(40);
    });
});
