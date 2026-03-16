import { describe, it } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { BoxElement } from "./BoxElement.ts";
import { RenderContext } from "./TUIElement.ts";
import { VStackElement } from "./VStackElement.ts";

function createVStack(
    width: number,
    height: number,
): { vstack: VStackElement; backend: MockTerminalBackend; termScreen: TerminalScreen } {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    const vstack = new VStackElement();
    return { vstack, backend, termScreen };
}

function renderVStack(
    vstack: VStackElement,
    termScreen: TerminalScreen,
    backend: MockTerminalBackend,
): MockTerminalBackend {
    vstack.performLayout(BoxConstraints.tight(termScreen.size));
    vstack.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("VStackElement", () => {
    it("renders two boxes stacked vertically", () => {
        const { vstack, backend, termScreen } = createVStack(10, 6);

        const box1 = new BoxElement();
        const box2 = new BoxElement();
        vstack.addChild(box1, { width: "fill", height: 3 });
        vstack.addChild(box2, { width: "fill", height: 3 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +--------+
                |        |
                +--------+
                +--------+
                |        |
                +--------+
            `,
        );
    });

    it("renders three boxes of different heights", () => {
        const { vstack, backend, termScreen } = createVStack(8, 7);

        const box1 = new BoxElement();
        const box2 = new BoxElement();
        const box3 = new BoxElement();
        vstack.addChild(box1, { width: "fill", height: 2 });
        vstack.addChild(box2, { width: "fill", height: 3 });
        vstack.addChild(box3, { width: "fill", height: 2 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +------+
                +------+
                +------+
                |      |
                +------+
                +------+
                +------+
            `,
        );
    });

    it("renders a child with width smaller than container", () => {
        const { vstack, backend, termScreen } = createVStack(8, 4);

        const narrowBox = new BoxElement();
        const wideBox = new BoxElement();
        vstack.addChild(narrowBox, { width: 4, height: 2 });
        vstack.addChild(wideBox, { width: "fill", height: 2 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +--+
                +--+
                +------+
                +------+
            `,
        );
    });

    it("renders a single child", () => {
        const { vstack, backend, termScreen } = createVStack(6, 3);

        const box = new BoxElement();
        vstack.addChild(box, { width: "fill", height: 3 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +----+
                |    |
                +----+
            `,
        );
    });

    it("renders nested VStacks", () => {
        const { vstack: outer, backend, termScreen } = createVStack(10, 6);

        const inner = new VStackElement();
        const box1 = new BoxElement();
        const box2 = new BoxElement();
        inner.addChild(box1, { width: "fill", height: 2 });
        inner.addChild(box2, { width: "fill", height: 2 });

        const bottomBox = new BoxElement();
        outer.addChild(inner, { width: "fill", height: 4 });
        outer.addChild(bottomBox, { width: "fill", height: 2 });

        renderVStack(outer, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +--------+
                +--------+
                +--------+
                +--------+
                +--------+
                +--------+
            `,
        );
    });

    it("renders boxes that do not fill container height", () => {
        const { vstack, backend, termScreen } = createVStack(6, 5);

        const box = new BoxElement();
        vstack.addChild(box, { width: "fill", height: 2 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +----+
                +----+
            `,
        );
    });

    it("children default to container width when width is fill", () => {
        const { vstack, backend, termScreen } = createVStack(10, 3);

        const box = new BoxElement();
        vstack.addChild(box, { width: "fill", height: 3 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +--------+
                |        |
                +--------+
            `,
        );
    });

    it("renders multiple children with explicit widths", () => {
        const { vstack, backend, termScreen } = createVStack(10, 4);

        const box1 = new BoxElement();
        const box2 = new BoxElement();
        vstack.addChild(box1, { width: 6, height: 2 });
        vstack.addChild(box2, { width: 10, height: 2 });

        renderVStack(vstack, termScreen, backend);

        expectScreen(
            backend,
            screen`
                +----+
                +----+
                +--------+
                +--------+
            `,
        );
    });
});
