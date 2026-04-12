import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";

import { BoxElement } from "./BoxElement.ts";

export const meta: StoryMeta = {
    title: "BoxElement",
};

export function simpleBox(ctx: StoryContext): void {
    const box = new BoxElement();
    ctx.body.setContent(box);
}
