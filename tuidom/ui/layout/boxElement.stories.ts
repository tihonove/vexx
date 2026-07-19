import type { StoryContext, StoryMeta } from "../../../src/StoryRunner/StoryTypes.ts";

import { BoxElement } from "./boxElement.ts";

export const meta: StoryMeta = {
    title: "BoxElement",
};

export function simpleBox(ctx: StoryContext): void {
    const box = new BoxElement();
    ctx.body.setContent(box);
}
