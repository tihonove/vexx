import { Uri } from "../../Common/Uri.ts";
import type { EditorGroupController } from "../../Controllers/EditorGroupController.ts";
import type { IGutterChangeDecoration } from "../../Editor/Decorations/IGutterChangeDecoration.ts";

import type { IEditorDecorationsService } from "./IEditorDecorationsService.ts";

/**
 * Реализация {@link IEditorDecorationsService} поверх {@link EditorGroupController}.
 * Живёт в слое Extensions (Controllers ничего не знает про host).
 *
 * Находит открытые редакторы по совпадению ресурса (образец —
 * `DiagnosticsController.editorsForResource`) и проталкивает набор в каждый.
 */
export class EditorDecorationsServiceAdapter implements IEditorDecorationsService {
    private readonly group: EditorGroupController;

    public constructor(group: EditorGroupController) {
        this.group = group;
    }

    public setGutterChangeDecorations(uri: string, decorations: readonly IGutterChangeDecoration[]): void {
        for (let i = 0; i < this.group.editorCount; i++) {
            const editor = this.group.getEditor(i);
            if (editor === null) continue;
            if (editor.uri.toString() === uri) {
                editor.setGutterChangeDecorations(decorations);
            }
        }
    }
}
