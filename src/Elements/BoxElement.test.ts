import { describe, it } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { BoxElement } from "./BoxElement.ts";
import { RenderContext } from "./TUIElement.ts";

function renderBox(width: number, height: number): MockTerminalBackend {
    const backend = new MockTerminalBackend(width, height);
    const termScreen = new TerminalScreen(width, height);
    const box = new BoxElement();
    box.size = new Size(width, height);
    box.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("BoxElement", () => {
    it("renders a 6x3 box", () => {
        const backend = renderBox(6, 3);
        expectScreen(
            backend,
            screen`
                +----+
                |    |
                +----+
            `,
        );
    });

    it("renders a 4x4 box", () => {
        const backend = renderBox(4, 4);
        expectScreen(
            backend,
            screen`
                +--+
                |  |
                |  |
                +--+
            `,
        );
    });

    it("renders a minimal 2x2 box", () => {
        const backend = renderBox(2, 2);
        expectScreen(
            backend,
            screen`
                ++
                ++
            `,
        );
    });

    it("renders a 1x1 box as single +", () => {
        const backend = renderBox(1, 1);
        expectScreen(
            backend,
            screen`
                +
            `,
        );
    });

    it("renders a wide 10x2 box", () => {
        const backend = renderBox(10, 2);
        expectScreen(
            backend,
            screen`
                +--------+
                +--------+
            `,
        );
    });

    it("renders a tall 3x5 box", () => {
        const backend = renderBox(3, 5);
        expectScreen(
            backend,
            screen`
                +-+
                | |
                | |
                | |
                +-+
            `,
        );
    });

    it("renders a 3x1 horizontal line", () => {
        const backend = renderBox(3, 1);
        expectScreen(
            backend,
            screen`
                +-+
            `,
        );
    });

    it("renders a 1x3 vertical line", () => {
        const backend = renderBox(1, 3);
        expectScreen(
            backend,
            screen`
                +
                |
                +
            `,
        );
    });
});
