import { EndOfLine } from "../../../../editor/common/core/endOfLine.ts";
import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { EditorGroupControllerDIToken } from "./editorGroupController.ts";
import { StatusBarControllerDIToken } from "../statusbar/statusBarController.ts";

function setActiveEditorEol(accessor: Parameters<CommandAction["run"]>[0], eol: EndOfLine): void {
    accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.setEol(eol);
    accessor.get(StatusBarControllerDIToken).update();
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

export const toggleEolAction: CommandAction = {
    id: "workbench.action.editor.toggleEOL",
    title: "End of Line: Toggle LF / CRLF",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor === null) return;
        editor.setEol(editor.eol === EndOfLine.CRLF ? EndOfLine.LF : EndOfLine.CRLF);
        accessor.get(StatusBarControllerDIToken).update();
    },
};
