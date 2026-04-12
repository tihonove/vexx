import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";

import { ScrollBarDecorator } from "./ScrollContainerElement.ts";
import { ScrollViewport } from "./ScrollViewport.ts";
import { TextBlockElement } from "./TextBlockElement.ts";

export const meta: StoryMeta = {
    title: "ScrollViewport",
};

export function arrowKeyScroll(ctx: StoryContext): void {
    const textBlock = new TextBlockElement(100);
    const scrollViewport = new ScrollViewport(textBlock);
    const scrollContainer = new ScrollBarDecorator(scrollViewport);

    scrollViewport.addEventListener("keypress", (event) => {
        if (event.key === "ArrowDown") {
            scrollViewport.scrollBy(0, 1);
        } else if (event.key === "ArrowUp") {
            scrollViewport.scrollBy(0, -1);
        }
    });

    ctx.body.setContent(scrollContainer);
}
