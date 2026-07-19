import type { IDisposable } from "../../../base/common/disposable.ts";
import { Uri } from "../../../base/common/uri.ts";
import type { EditorService } from "../../services/editor/browser/editorService.ts";
import type {
    IActiveEditorMeta,
    IEditorOptionsPatch,
    IEditorOptionsService,
    IEditorOptionsState,
} from "../common/iEditorOptionsService.ts";

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
}

function metaOf(
    editor: { uri: Uri; languageId: string; isModified: boolean; encoding: string; eol: number } | null,
): IActiveEditorMeta {
    if (editor === null) return { uri: null, languageId: null, isDirty: false, encoding: null, eol: null };
    return {
        uri: editor.uri.toString(),
        languageId: editor.languageId,
        isDirty: editor.isModified,
        encoding: editor.encoding,
        eol: editor.eol === 2 ? 2 : 1,
    };
}
