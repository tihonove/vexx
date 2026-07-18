import * as fs from "node:fs";

import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import { SUPPORTED_ENCODINGS } from "../../Editor/Encoding.ts";
import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { CommandRegistryDIToken } from "../../Workbench/Services/CommandRegistry.ts";
import { DialogServiceDIToken } from "../../Workbench/Services/DialogService.ts";
import { QuickInputServiceDIToken } from "../../Workbench/Services/QuickInputService.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

/**
 * Encoding picker (VS Code `workbench.action.editor.changeEncoding`):
 * двухуровневый флоу — сначала «Reopen with Encoding» / «Save with
 * Encoding», затем список кодировок с текущей в активной позиции.
 * «Reopen» скрыт для буферов без файла на диске (untitled); на «грязном»
 * буфере он сначала спрашивает подтверждение (перечитка отбрасывает
 * несохранённые правки). «Save» у безымянного буфера выставляет кодировку
 * и уводит в Save As (команда `workbench.action.files.saveAs`); конфликт с
 * внешней записью идёт через тот же Overwrite-диалог, что и обычный Save.
 *
 * Остаётся в Controllers/Actions: тянет активный редактор и displayName через
 * `EditorGroupController` (уедет со швом редактора на этапе 9).
 */
async function changeFileEncoding(accessor: ServiceAccessor): Promise<void> {
    const editorGroup = accessor.get(EditorGroupControllerDIToken);
    const quickInput = accessor.get(QuickInputServiceDIToken);
    const dialogService = accessor.get(DialogServiceDIToken);

    const editor = editorGroup.getActiveEditor();
    if (editor === null) return;

    const canReopen = editor.absoluteFilePath !== null && fs.existsSync(editor.absoluteFilePath);
    const modeItems = [
        ...(canReopen ? [{ label: "Reopen with Encoding", description: "Reinterpret the file on disk" }] : []),
        { label: "Save with Encoding", description: "Write the file in a different encoding" },
    ];
    const mode = await quickInput.quickPick({
        title: "Change File Encoding",
        placeholder: "Select Action",
        items: modeItems,
    });
    if (mode === undefined) return;

    const current = editor.encoding;
    const encodingItems = SUPPORTED_ENCODINGS.map((info) => ({ label: info.label, description: info.id }));
    const picked = await quickInput.quickPick({
        title: mode.label,
        placeholder: "Select File Encoding",
        items: encodingItems,
        activeIndex: Math.max(
            0,
            SUPPORTED_ENCODINGS.findIndex((info) => info.id === current),
        ),
    });
    if (picked === undefined || picked.description === undefined) return;
    const encoding = picked.description;

    if (mode.label === "Reopen with Encoding") {
        const doReopen = (): void => {
            editor.reopenWithEncoding(encoding);
        };
        if (editor.isModified) {
            const name = editorGroup.displayName(editor);
            dialogService.showConfirmDialog(
                {
                    title: "Reopen with Encoding",
                    message: [`"${name}" has unsaved changes.`, "Reopening the file will discard them. Continue?"],
                    confirmLabel: "Reopen",
                    cancelLabel: "Cancel",
                    defaultButton: "cancel",
                },
                { onConfirm: doReopen },
            );
            return;
        }
        doReopen();
        return;
    }

    const outcome = await editor.saveWithEncoding(encoding);
    if (outcome === "no-file") {
        // Безымянный буфер: кодировка уже выставлена, путь спросит Save As.
        accessor.get(CommandRegistryDIToken).execute("workbench.action.files.saveAs");
        return;
    }
    if (outcome === "conflict") {
        const name = editorGroup.displayName(editor);
        dialogService.showConfirmDialog(
            {
                title: "Overwrite",
                message: [
                    `The file "${name}" has been changed on disk.`,
                    "Do you want to overwrite the version on disk with your changes?",
                ],
                confirmLabel: "Overwrite",
                cancelLabel: "Cancel",
                defaultButton: "cancel",
            },
            {
                onConfirm: () => {
                    void editor.save({ overwrite: true });
                },
            },
        );
        return;
    }
}

export const changeEncodingAction: CommandAction = {
    id: "workbench.action.editor.changeEncoding",
    title: "Change File Encoding",
    run(accessor) {
        void changeFileEncoding(accessor);
    },
};
