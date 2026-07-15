import type { CommandAction } from "../CommandAction.ts";

/**
 * Open the encoding picker (VS Code `workbench.action.editor.changeEncoding`):
 * "Reopen with Encoding" / "Save with Encoding" → encoding list. The real
 * handler is installed by `AppController` (it needs quick picks and confirm
 * dialogs); this only declares id / title.
 */
export const changeEncodingAction: CommandAction = {
    id: "workbench.action.editor.changeEncoding",
    title: "Change File Encoding",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};
