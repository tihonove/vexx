import type { IDisposable } from "../../Common/Disposable.ts";
import { Uri } from "../../Common/Uri.ts";
import type { EditorGroupController } from "../../Controllers/EditorGroupController.ts";

import type {
    IActiveEditorMeta,
    IEditorOptionsPatch,
    IEditorOptionsService,
    IEditorOptionsState,
} from "./IEditorOptionsService.ts";

/**
 * Реализация {@link IEditorOptionsService} поверх {@link EditorGroupController}.
 * Живёт в слое Extensions (Controllers ничего не должен знать про host).
 */
export class EditorOptionsServiceAdapter implements IEditorOptionsService {
    private readonly group: EditorGroupController;

    public constructor(group: EditorGroupController) {
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
        return uri !== undefined && uri.scheme === "file" ? uri.fsPath : null;
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

function metaOf(editor: { uri: Uri; languageId: string; isModified: boolean } | null): IActiveEditorMeta {
    if (editor === null) return { uri: null, languageId: null, isDirty: false };
    return {
        uri: editor.uri.toString(),
        languageId: editor.languageId,
        isDirty: editor.isModified,
    };
}
