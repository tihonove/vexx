import * as fs from "node:fs";

import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

export const fileDeleteAction: CommandAction = {
    id: "fileOperations.deleteFile",
    title: "File: Delete",
    keybinding: parseKeybinding("delete"),
    when: "listFocus",
    run(_accessor, filePath: unknown) {
        fs.rmSync(filePath as string, { recursive: true, force: true });
    },
};
