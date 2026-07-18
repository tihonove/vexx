import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import { EndOfLine } from "../../Editor/EndOfLine.ts";
import type { CommandAction } from "./CommandAction.ts";
import { QuickInputServiceDIToken } from "../Services/QuickInputService.ts";
import { EditorServiceDIToken } from "../Services/EditorService.ts";

function setActiveEditorEol(accessor: Parameters<CommandAction["run"]>[0], eol: EndOfLine): void {
    // Сегмент статус-бара обновится сам: EditorStatusContribution подписан на onDidChangeEol.
    accessor.get(EditorServiceDIToken).getActiveEditor()?.setEol(eol);
}

export const convertToLfAction: CommandAction = {
    id: "workbench.action.editor.setEOL.lf",
    title: "End of Line: Convert to LF (\\n)",
    run(accessor) {
        setActiveEditorEol(accessor, EndOfLine.LF);
    },
};

export const convertToCrlfAction: CommandAction = {
    id: "workbench.action.editor.setEOL.crlf",
    title: "End of Line: Convert to CRLF (\\r\\n)",
    run(accessor) {
        setActiveEditorEol(accessor, EndOfLine.CRLF);
    },
};

/**
 * EOL picker (VS Code `workbench.action.editor.changeEOL`): quick pick с
 * LF / CRLF, активная позиция — текущий EOL документа.
 */
async function changeEol(accessor: ServiceAccessor): Promise<void> {
    const editor = accessor.get(EditorServiceDIToken).getActiveEditor();
    if (editor === null) return;

    const picked = await accessor.get(QuickInputServiceDIToken).quickPick({
        title: "Change End of Line Sequence",
        placeholder: "Select End of Line Sequence",
        items: [
            { label: "LF", description: "\\n" },
            { label: "CRLF", description: "\\r\\n" },
        ],
        activeIndex: editor.eol === EndOfLine.CRLF ? 1 : 0,
    });
    if (picked === undefined) return;

    editor.setEol(picked.label === "CRLF" ? EndOfLine.CRLF : EndOfLine.LF);
}

export const changeEolAction: CommandAction = {
    id: "workbench.action.editor.changeEOL",
    title: "Change End of Line Sequence",
    run(accessor) {
        void changeEol(accessor);
    },
};

export const toggleEolAction: CommandAction = {
    id: "workbench.action.editor.toggleEOL",
    title: "End of Line: Toggle LF / CRLF",
    run(accessor) {
        const editor = accessor.get(EditorServiceDIToken).getActiveEditor();
        if (editor === null) return;
        editor.setEol(editor.eol === EndOfLine.CRLF ? EndOfLine.LF : EndOfLine.CRLF);
    },
};
