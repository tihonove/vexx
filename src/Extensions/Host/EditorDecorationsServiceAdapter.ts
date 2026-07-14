import * as path from "node:path";

import type { EditorGroupController } from "../../Controllers/EditorGroupController.ts";
import type { IGutterChangeDecoration } from "../../vs/editor/common/model/gutterChangeDecoration.ts";

import type { IEditorDecorationsService } from "./IEditorDecorationsService.ts";

/**
 * Реализация {@link IEditorDecorationsService} поверх {@link EditorGroupController}.
 * Живёт в слое Extensions (Controllers ничего не знает про host).
 *
 * Находит открытые редакторы по совпадению абсолютного пути (образец —
 * `DiagnosticsController.editorsForResource`) и проталкивает набор в каждый.
 */
export class EditorDecorationsServiceAdapter implements IEditorDecorationsService {
    private readonly group: EditorGroupController;

    public constructor(group: EditorGroupController) {
        this.group = group;
    }

    public setGutterChangeDecorations(fileName: string, decorations: readonly IGutterChangeDecoration[]): void {
        const resolved = path.resolve(fileName);
        for (let i = 0; i < this.group.editorCount; i++) {
            const editor = this.group.getEditor(i);
            if (editor === null) continue;
            const editorPath = editor.absoluteFilePath;
            if (editorPath !== null && path.resolve(editorPath) === resolved) {
                editor.setGutterChangeDecorations(decorations);
            }
        }
    }
}
