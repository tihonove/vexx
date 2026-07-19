import { describe, expect, it } from "vitest";

import { TestApp } from "../../../../../TestUtils/TestApp.ts";
import { packRgb } from "../../../common/colorUtils.ts";
import { BoxConstraints, Point, Size } from "../../../common/geometryPromitives.ts";
import { RenderContext, TUIElement } from "../../tuiElement.ts";

import { EditorGroupElement } from "./editorGroupElement.ts";

const EDITOR_BG = packRgb(10, 20, 30);
const OVERLAY_BG = packRgb(200, 100, 50);

/** Solid-colour element. Fills its allotted size, or a fixed size if given. */
class FillElement extends TUIElement {
    private readonly color: number;
    private readonly fixed?: Size;

    public constructor(color: number, fixed?: Size) {
        super();
        this.color = color;
        this.fixed = fixed;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        return super.performLayout(this.fixed ? BoxConstraints.tight(this.fixed) : constraints);
    }

    public override render(context: RenderContext): void {
        const { width, height } = this.layoutSize;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                context.setCell(x, y, { char: " ", bg: this.color });
            }
        }
    }
}

function createGroup(width = 20, height = 5): { app: TestApp; group: EditorGroupElement; content: FillElement } {
    const group = new EditorGroupElement();
    const content = new FillElement(EDITOR_BG);
    group.setContent(content);
    const app = TestApp.createWithContent(group, new Size(width, height));
    return { app, group, content };
}

describe("EditorGroupElement — overlay layer", () => {
    it("renders an overlay item on top of the editor content", () => {
        const { app, group } = createGroup();
        // Item 5×1 at (0,1): the first content row, below the 1-row tab strip.
        group.overlayLayer.addItem(new FillElement(OVERLAY_BG, new Size(5, 1)), new Point(0, 1), true);
        app.render();

        // Inside the item → overlay colour (wins over the editor underneath).
        expect(app.backend.getBgAt(new Point(0, 1))).toBe(OVERLAY_BG);
        // Outside the item, same row → editor content still shows through.
        expect(app.backend.getBgAt(new Point(10, 1))).toBe(EDITOR_BG);
    });

    it("positions overlay items relative to the group", () => {
        const { app, group } = createGroup();
        const item = new FillElement(OVERLAY_BG, new Size(3, 1));
        group.overlayLayer.addItem(item, new Point(2, 1), true);
        app.render();

        expect(item.globalPosition).toEqual(new Point(group.globalPosition.x + 2, group.globalPosition.y + 1));
        // The layer spans the whole group, so items are clipped to the group bounds.
        expect(group.overlayLayer.layoutSize).toEqual(group.layoutSize);
    });

    it("does not affect the editor content layout", () => {
        const { app, group, content } = createGroup();
        app.render();
        const sizeBefore = content.layoutSize;
        const posBefore = content.globalPosition;

        group.overlayLayer.addItem(new FillElement(OVERLAY_BG, new Size(5, 1)), new Point(0, 1), true);
        app.render();

        expect(content.layoutSize).toEqual(sizeBefore);
        expect(content.globalPosition).toEqual(posBefore);
    });
});
