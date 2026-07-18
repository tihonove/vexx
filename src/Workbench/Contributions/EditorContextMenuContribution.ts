import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import type { CommandRegistry } from "../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const EditorContextMenuContributionDIToken = token<EditorContextMenuContribution>(
    "EditorContextMenuContribution",
);

/**
 * Наполняет контекст-меню каждого создаваемого редактора стандартными пунктами
 * (Copy/Cut/Paste · Undo), исполняющими команды через `CommandRegistry`.
 * Ставит `EditorService.onEditorCreate` в mount() — до открытия первого
 * редактора, поэтому меню получают все редакторы.
 */
export class EditorContextMenuContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [EditorServiceDIToken, CommandRegistryDIToken] as const;

    public constructor(
        private readonly editorService: EditorService,
        private readonly commands: CommandRegistry,
    ) {
        super();
        this.editorService.onEditorCreate = (editor) => {
            editor.contextMenuEntries = [
                {
                    label: "Copy",
                    shortcut: "Ctrl+C",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardCopyAction");
                    },
                },
                {
                    label: "Cut",
                    shortcut: "Ctrl+X",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardCutAction");
                    },
                },
                {
                    label: "Paste",
                    shortcut: "Ctrl+V",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardPasteAction");
                    },
                },
                { type: "separator" },
                {
                    label: "Undo",
                    shortcut: "Ctrl+Z",
                    onSelect: () => {
                        this.commands.execute("undo");
                    },
                },
            ];
        };
    }
}
