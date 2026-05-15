import * as fs from "node:fs";

import type { CommandAction } from "../CommandAction.ts";

export const fileDeleteAction: CommandAction = {
    id: "fileOperations.deleteFile",
    title: "File: Delete",
    run(_accessor, filePath: unknown) {
        fs.rmSync(filePath as string, { recursive: true, force: true });
    },
};
