import { describe, expect, it } from "vitest";

import { BoxElement } from "../vs/base/browser/ui/layout/boxElement.ts";
import { TextLabelElement } from "../vs/base/browser/ui/text/textLabelElement.ts";
import { BoxConstraints, Point, Size } from "../vs/base/common/geometryPromitives.ts";

import { expectScreen, screen } from "./expectScreen.ts";
import { renderElement } from "./renderElement.ts";

describe("renderElement", () => {
    it("рендерит элемент tight-constraints по размеру бэкенда (дефолт)", () => {
        const backend = renderElement(new BoxElement(), 6, 3);
        expectScreen(
            backend,
            screen`
                +----+
                |    |
                +----+
            `,
        );
    });

    it("уважает кастомные constraints, отличные от размера бэкенда", () => {
        const backend = renderElement(new BoxElement(), 8, 3, {
            constraints: BoxConstraints.tight(new Size(4, 3)),
        });
        expectScreen(
            backend,
            screen`
                +--+
                |  |
                +--+
            `,
        );
    });

    it("resolveStyles прогоняет style resolution перед рендером", () => {
        const label = new TextLabelElement("hi");
        const backend = renderElement(label, 5, 1, { resolveStyles: true });
        expect(backend.getTextAt(new Point(0, 0), 2)).toBe("hi");
    });
});
