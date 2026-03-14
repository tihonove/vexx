import { describe, it, expect } from "vitest";
import { TuiApplication } from "./TuiApplication.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { BoxElement } from "../Elements/BoxElement.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";
import { Size } from "../Common/GeometryPromitives.ts";

describe("TuiApplication", () => {
    it("renders root element on run()", () => {
        const backend = new MockTerminalBackend(new Size(6, 3));
        const app = new TuiApplication(backend);

        const box = new BoxElement();
        app.root = box;
        app.run();

        expectScreen(
            backend,
            screen`
                +----+
                |    |
                +----+
            `,
        );
    });

    it("sets root size to match terminal dimensions", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        const app = new TuiApplication(backend);

        const box = new BoxElement();
        app.root = box;
        app.run();

        expect(box.size.width).toBe(10);
        expect(box.size.height).toBe(5);
    });

    it("re-renders with new size on terminal resize", () => {
        const backend = new MockTerminalBackend(new Size(6, 3));
        const app = new TuiApplication(backend);

        const box = new BoxElement();
        app.root = box;
        app.run();

        // Verify initial render
        expectScreen(
            backend,
            screen`
                +----+
                |    |
                +----+
            `,
        );

        // Simulate resize
        backend.resize(new Size(8, 4));

        expectScreen(
            backend,
            screen`
                +------+
                |      |
                |      |
                +------+
            `,
        );

        expect(box.size.width).toBe(8);
        expect(box.size.height).toBe(4);
    });

    it("updates screen dimensions on resize", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        const app = new TuiApplication(backend);
        app.root = new BoxElement();
        app.run();

        expect(app.screen.width).toBe(10);
        expect(app.screen.height).toBe(5);

        backend.resize(new Size(20, 10));

        expect(app.screen.width).toBe(20);
        expect(app.screen.height).toBe(10);
    });
});
