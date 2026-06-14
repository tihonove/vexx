import type { IDisposable } from "../../Common/Disposable.ts";
import type { EditorGroupController } from "../../Controllers/EditorGroupController.ts";

import type { IEditorOptionsPatch, IEditorOptionsService, IEditorOptionsState } from "./IEditorOptionsService.ts";

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
        return this.group.getActiveEditor()?.absoluteFilePath ?? null;
    }

    public onActiveEditorChanged(cb: (filePath: string | null) => void): IDisposable {
        return this.group.onActiveEditorChanged((editor) => {
            cb(editor?.absoluteFilePath ?? null);
        });
    }
}
