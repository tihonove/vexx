import type { ITextEdit } from "../../../../editor/common/core/iTextEdit.ts";

/**
 * Модель правок уровня workspace (à la VS Code `WorkspaceEdit`): упорядоченный набор
 * операций над ресурсами — либо файловая операция, либо текстовая правка ресурса.
 */

export type FileEditKind = "create" | "delete" | "move" | "rename" | "copy";

/**
 * Файловая операция. Дискриминируется по `kind`: набор полей зависит от вида правки.
 * - move/copy — источник `from` и целевой каталог `to` (как при вставке);
 * - rename — источник `from` и точный целевой путь `to` (переименование на месте);
 * - delete — только источник `from`;
 * - create — путь создаваемого ресурса `to` (+ `directory` для каталога).
 */
export type ResourceFileEdit =
    | { readonly kind: "move"; readonly from: string; readonly to: string }
    | { readonly kind: "rename"; readonly from: string; readonly to: string }
    | { readonly kind: "copy"; readonly from: string; readonly to: string }
    | { readonly kind: "delete"; readonly from: string }
    | { readonly kind: "create"; readonly to: string; readonly directory?: boolean };

export interface ResourceTextEdit {
    readonly resource: string;
    readonly edits: readonly ITextEdit[];
}

export type ResourceEdit = ResourceFileEdit | ResourceTextEdit;
export type WorkspaceEdit = readonly ResourceEdit[];

export function isResourceFileEdit(edit: ResourceEdit): edit is ResourceFileEdit {
    return "kind" in edit;
}
