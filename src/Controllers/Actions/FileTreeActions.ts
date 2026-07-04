import * as fs from "node:fs";

import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const fileDeleteAction: CommandAction = {
    id: "fileOperations.deleteFile",
    title: "File: Delete",
    keybinding: parseKeybinding("delete"),
    when: "listFocus",
    run(_accessor, filePath: unknown) {
        fs.rmSync(filePath as string, { recursive: true, force: true });
    },
};
