import { describe, it, expect } from "vitest";
import { BodyElement } from "../Elements/BodyElement.ts";
import { TuiApplication } from "../Application/TuiApplication.ts";
import { MockTerminalBackend } from "./MockTerminalBackend.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

describe("TuiApplication integration with MockTerminalBackend", () => {
    it("types characters and renders them on screen", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
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

        expect(backend.getTextAt(new Point(0, 0), 2)).toBe("hi");
    });

    it("screenToString contains typed text", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
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
        const lines = screenText.split("\n");
        expect(lines[0].slice(0, 3)).toBe("ABC");
    });

    it("screen is clean before any input", () => {
        const backend = new MockTerminalBackend(new Size(20, 5));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run();

        // No input yet — backend screen should be all spaces (null cells)
        expect(backend.screenToString()).toBe(Array(5).fill(" ".repeat(20)).join("\n"));
    });

    it("uses custom terminal size from backend", () => {
        const backend = new MockTerminalBackend(new Size(120, 40));
        const app = new TuiApplication(backend);

        expect(app.screen.width).toBe(120);
        expect(app.screen.height).toBe(40);
    });

    it("handles arrow key events through the element", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        const receivedKeys: string[] = [];
        body.addEventListener("keypress", (event) => {
            receivedKeys.push(event.key);
        });
        app.root = body;
        app.run();

        backend.sendKey("ArrowUp");
        backend.sendKey("ArrowDown");

        expect(receivedKeys).toEqual(["ArrowUp", "ArrowDown"]);
    });

    it("receives modifier flags on events", () => {
        const backend = new MockTerminalBackend(new Size(80, 24));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        let lastCtrl = false;
        body.addEventListener("keypress", (event) => {
            lastCtrl = event.ctrlKey;
        });
        app.root = body;
        app.run();

        backend.sendKey("Ctrl+A");

        expect(lastCtrl).toBe(true);
    });
});
