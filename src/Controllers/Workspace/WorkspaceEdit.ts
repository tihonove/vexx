import type { ITextEdit } from "../../Editor/ITextEdit.ts";

/**
 * Модель правок уровня workspace (à la VS Code `WorkspaceEdit`): упорядоченный набор
 * операций над ресурсами — либо файловая операция, либо текстовая правка ресурса.
 */

export type FileEditKind = "create" | "delete" | "move" | "copy";

export interface ResourceFileEdit {
    readonly kind: FileEditKind;
    /** Источник: путь существующего файла/папки (для delete/move/copy). */
    readonly from?: string;
    /**
     * Назначение. Для move/copy — целевой каталог (как при вставке).
     * Для create — путь создаваемого файла.
     */
    readonly to?: string;
    /** Только для kind "create": создать каталог, а не пустой файл. */
    readonly directory?: boolean;
}

export interface ResourceTextEdit {
    readonly resource: string;
    readonly edits: readonly ITextEdit[];
}

export type ResourceEdit = ResourceFileEdit | ResourceTextEdit;
export type WorkspaceEdit = readonly ResourceEdit[];

export function isResourceFileEdit(edit: ResourceEdit): edit is ResourceFileEdit {
    return "kind" in edit;
}
