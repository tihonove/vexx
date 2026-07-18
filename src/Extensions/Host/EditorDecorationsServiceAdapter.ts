import { Uri } from "../../Common/Uri.ts";
import type { IGutterChangeDecoration } from "../../Editor/Decorations/IGutterChangeDecoration.ts";
import type { EditorService } from "../../Workbench/Services/EditorService.ts";

import type { IEditorDecorationsService } from "./IEditorDecorationsService.ts";

/**
 * Реализация {@link IEditorDecorationsService} поверх {@link EditorService}.
 * Живёт в слое Extensions (Workbench ничего не знает про host).
 *
 * Находит открытые редакторы по совпадению ресурса (образец —
 * `DiagnosticsService.editorsForResource`) и проталкивает набор в каждый.
 */
export class EditorDecorationsServiceAdapter implements IEditorDecorationsService {
    private readonly group: EditorService;

    public constructor(group: EditorService) {
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
