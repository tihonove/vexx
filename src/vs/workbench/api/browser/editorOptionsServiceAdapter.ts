import type { IDisposable } from "../../../../../tuidom/common/disposable.ts";
import { Uri } from "../../../base/common/uri.ts";
import { createSelection, type ISelection } from "../../../editor/common/core/iSelection.ts";
import { createRange } from "../../../editor/common/core/iRange.ts";
import { createTextEdit, type ITextEdit } from "../../../editor/common/core/iTextEdit.ts";
import type { EditorPane } from "../../browser/parts/editor/editorPane.ts";
import type { EditorService } from "../../services/editor/browser/editorService.ts";
import type {
    IActiveEditorMeta,
    IEditorOptionsPatch,
    IEditorOptionsService,
    IEditorOptionsState,
} from "../common/iEditorOptionsService.ts";
import type { IWireEditorEdit, IWireSelection } from "../common/wireTypes.ts";

/**
 * Реализация {@link IEditorOptionsService} поверх {@link EditorService}.
 * Живёт в слое Extensions (Workbench ничего не должен знать про host).
 */
export class EditorOptionsServiceAdapter implements IEditorOptionsService {
    private readonly group: EditorService;

    public constructor(group: EditorService) {
        this.group = group;
    }

    public getActiveEditorOptions(): IEditorOptionsState | null {
        const editor = this.group.getActiveEditor();
        if (editor === null) return null;
        return {
            tabSize: editor.viewState.tabSize,
            insertSpaces: editor.viewState.insertSpaces,
        };
    }

    public setActiveEditorOptions(patch: IEditorOptionsPatch): void {
        const editor = this.group.getActiveEditor();
        if (editor === null) return;
        editor.setIndentOptions(patch);
    }

    public getActiveEditorFilePath(): string | null {
        const uri = this.group.getActiveEditor()?.uri;
        // Потребитель (editorconfig) ждёт путь на диске; у безымянного буфера его нет.
        return uri?.scheme === "file" ? uri.fsPath : null;
    }

    public getActiveEditorMeta(): IActiveEditorMeta {
        return metaOf(this.group.getActiveEditor());
    }

    public onActiveEditorChanged(cb: (meta: IActiveEditorMeta) => void): IDisposable {
        return this.group.onActiveEditorChanged((editor) => {
            cb(metaOf(editor));
        });
    }

    public setActiveEditorSelections(uri: string, selections: readonly IWireSelection[]): void {
        const editor = this.activeEditorFor(uri);
        if (editor === null || selections.length === 0) return;
        const doc = editor.model.document;
        const mapped: ISelection[] = selections.map((sel) => {
            const anchor = clampPosition(doc, sel.anchorLine, sel.anchorCharacter);
            const active = clampPosition(doc, sel.activeLine, sel.activeCharacter);
            return createSelection(anchor.line, anchor.character, active.line, active.character);
        });
        editor.viewState.selections = mapped;
        editor.focusEditor();
    }

    public applyActiveEditorEdits(uri: string, edits: readonly IWireEditorEdit[]): boolean {
        const editor = this.activeEditorFor(uri);
        if (editor === null || edits.length === 0) return false;
        const doc = editor.model.document;
        const textEdits: ITextEdit[] = edits.map((edit) => {
            const start = clampPosition(doc, edit.range.startLine, edit.range.startCharacter);
            const end = clampPosition(doc, edit.range.endLine, edit.range.endCharacter);
            return createTextEdit(createRange(start.line, start.character, end.line, end.character), edit.text);
        });
        editor.applyExternalEdits(textEdits, "extension edit");
        return true;
    }

    /** Активный редактор, если его uri совпадает с ожидаемым (иначе `null`). */
    private activeEditorFor(uri: string): EditorPane | null {
        const editor = this.group.getActiveEditor();
        if (editor === null || editor.uri.toString() !== uri) return null;
        return editor;
    }
}

function clampPosition(
    doc: { lineCount: number; getLineLength(line: number): number },
    line: number,
    character: number,
): { line: number; character: number } {
    const maxLine = doc.lineCount - 1;
    const clampedLine = line < 0 ? 0 : line > maxLine ? maxLine : line;
    const maxChar = doc.getLineLength(clampedLine);
    const clampedChar = character < 0 ? 0 : character > maxChar ? maxChar : character;
    return { line: clampedLine, character: clampedChar };
}

function metaOf(editor: EditorPane | null): IActiveEditorMeta {
    if (editor === null) {
        return { uri: null, languageId: null, isDirty: false, encoding: null, eol: null, selection: null };
    }
    const primary = editor.viewState?.selections[0];
    const selection: IWireSelection | null =
        primary === undefined
            ? null
            : {
                  anchorLine: primary.anchor.line,
                  anchorCharacter: primary.anchor.character,
                  activeLine: primary.active.line,
                  activeCharacter: primary.active.character,
              };
    return {
        uri: editor.uri.toString(),
        languageId: editor.languageId,
        isDirty: editor.isModified,
        encoding: editor.encoding,
        eol: editor.eol === 2 ? 2 : 1,
        selection,
    };
}
