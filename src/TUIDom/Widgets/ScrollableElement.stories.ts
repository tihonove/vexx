import { reject } from "../../Common/TypingUtils.ts";
import { WASDScrollableElement } from "../../demos/WASDScrollableElement.ts";
import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";

import { ScrollBarDecorator } from "./ScrollContainerElement.ts";

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
