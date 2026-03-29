import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../Backend/MockTerminalBackend.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { DEFAULT_COLOR } from "../Rendering/ColorUtils.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { TuiApplication } from "./TuiApplication.ts";
import { BoxElement } from "./Widgets/BoxElement.ts";

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

    it("clears stale selection background between frames", () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const doc = new TextDocument("hello");
        const viewState = new EditorViewState(doc);
        const editor = new EditorElement(viewState);
        app.root = editor;
        app.run();

        // Select "ello" via Shift+ArrowLeft × 4 from end
        // First move cursor to end of "hello"
        backend.sendKey("End");
        // Select backwards
        backend.sendKey("Shift+ArrowLeft");
        backend.sendKey("Shift+ArrowLeft");
        backend.sendKey("Shift+ArrowLeft");
        backend.sendKey("Shift+ArrowLeft");

        // Characters 1..4 ("ello") should have selection bg
        for (let x = 1; x <= 4; x++) {
            expect(backend.getBgAt(new Point(x, 0))).not.toBe(DEFAULT_COLOR);
        }

        // Deselect by pressing ArrowRight (collapses selection)
        backend.sendKey("ArrowRight");

        // Now ALL cells on the first line should have DEFAULT_COLOR bg
        for (let x = 0; x < 5; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(DEFAULT_COLOR);
        }
    });
});
