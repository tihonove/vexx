import * as path from "node:path";

import { FileTreeController } from "../../Controllers/FileTreeController.ts";
import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";

export const meta: StoryMeta = {
    title: "TreeViewElement",
};

export function fileTree(ctx: StoryContext): void {
    const rootPath = ctx.args[0] ?? path.resolve(".");

    const controller = new FileTreeController();
    controller.setRootPath(rootPath);
    controller.onFileActivate = (filePath) => {
        // eslint-disable-next-line no-console
        console.log("Activate file:", filePath);
    };
    controller.mount();

    ctx.body.setContent(controller.view);

    ctx.afterRun(() => {
        controller.focus();
        void controller.activate();
    });
}
