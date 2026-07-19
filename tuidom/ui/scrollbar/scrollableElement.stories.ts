import type { StoryContext, StoryMeta } from "../../../src/StoryRunner/StoryTypes.ts";
import { reject } from "../../common/typingUtils.ts";
import { WASDScrollableElement } from "../../demos/WASDScrollableElement.ts";

import { ScrollBarDecorator } from "./scrollContainerElement.ts";

export const meta: StoryMeta = {
    title: "ScrollableElement",
};

export function wasdGrid(ctx: StoryContext): void {
    const widget = new WASDScrollableElement(220, 90);
    const container = new ScrollBarDecorator(widget);
    ctx.body.setContent(container);

    ctx.afterRun(() => {
        (ctx.app.focusManager ?? reject()).setFocus(widget);
    });
}
