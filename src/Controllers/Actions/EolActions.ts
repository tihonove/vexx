import { EndOfLine } from "../../Editor/EndOfLine.ts";
import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

function setActiveEditorEol(accessor: Parameters<CommandAction["run"]>[0], eol: EndOfLine): void {
    // Сегмент статус-бара обновится сам: EditorStatusContribution подписан на onDidChangeEol.
    accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.setEol(eol);
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
 * Open the EOL picker (VS Code `workbench.action.editor.changeEOL`): a quick
 * pick with LF / CRLF. The real handler is installed by `AppController`; this
 * only declares id / title.
 */
export const changeEolAction: CommandAction = {
    id: "workbench.action.editor.changeEOL",
    title: "Change End of Line Sequence",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const toggleEolAction: CommandAction = {
    id: "workbench.action.editor.toggleEOL",
    title: "End of Line: Toggle LF / CRLF",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor === null) return;
        editor.setEol(editor.eol === EndOfLine.CRLF ? EndOfLine.LF : EndOfLine.CRLF);
    },
};
