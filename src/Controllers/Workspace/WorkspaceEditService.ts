import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../../Common/DiContainer.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import { copyInto, moveInto, moveToPath, resolveNonConflictingDest } from "../Actions/fileClipboardFs.ts";

import type { IUndoRedoElement } from "./IUndoRedoElement.ts";
import { TrashService, TrashServiceDIToken } from "./TrashService.ts";
import { UndoRedoService, UndoRedoServiceDIToken, WORKSPACE_UNDO_CONTEXT } from "./UndoRedoService.ts";
import type { ResourceFileEdit } from "./WorkspaceEdit.ts";

interface ReversibleOp {
    undo(): void;
    redo(): void;
    confirmBeforeUndo?: string;
}

/**
 * Исполняет файловые правки (`ResourceFileEdit`) и записывает обратимый шаг в общую
 * историю (`UndoRedoService`, контекст `WORKSPACE`). Удаление идёт в системную корзину,
 * если она доступна (тогда отменяемо); иначе — безвозвратно (в историю не пишется).
 */
export class WorkspaceEditService {
    public static readonly dependencies = [
        UndoRedoServiceDIToken,
        TrashServiceDIToken,
        IConfigurationServiceDIToken,
    ] as const;

    public constructor(
        private readonly undoRedo: UndoRedoService,
        private readonly trash: TrashService,
        private readonly config: IConfigurationService,
    ) {}

    /** Пойдёт ли удаление в корзину (настройка разрешает И корзина реально доступна). */
    public willMoveToTrash(): boolean {
        const enabled = this.config.get<boolean>("files.enableTrash", true) ?? true;
        return enabled && this.trash.isAvailable();
    }

    /**
     * Выполняет операции и кладёт обратимый элемент в историю. Возвращает элемент, либо
     * `null`, если ни одна операция не отменяема (например, только безвозвратное удаление).
     */
    public applyFileEdits(edits: readonly ResourceFileEdit[], label: string): IUndoRedoElement | null {
        const ops: ReversibleOp[] = [];
        const resources: string[] = [];

        for (const edit of edits) {
            try {
                this.applyOne(edit, ops, resources);
            } catch {
                // Ошибка по одной записи не прерывает остальные (как в pasteFiles).
            }
        }

        if (ops.length === 0) return null;

        const confirmBeforeUndo = ops.map((o) => o.confirmBeforeUndo).find((m): m is string => m !== undefined);
        const element: IUndoRedoElement = {
            label,
            resources,
            ...(confirmBeforeUndo ? { confirmBeforeUndo } : {}),
            async undo() {
                for (let i = ops.length - 1; i >= 0; i--) await ops[i].undo();
            },
            async redo() {
                for (const op of ops) await op.redo();
            },
        };
        this.undoRedo.pushElement(element, WORKSPACE_UNDO_CONTEXT);
        return element;
    }

    private applyOne(edit: ResourceFileEdit, ops: ReversibleOp[], resources: string[]): void {
        if (edit.kind === "move") {
            const from = edit.from!;
            const toDir = edit.to!;
            let current = moveInto(from, toDir);
            resources.push(from, current);
            ops.push({
                undo: () => {
                    current = moveBack(current, from);
                },
                redo: () => {
                    current = moveInto(current, toDir);
                },
            });
        } else if (edit.kind === "copy") {
            const from = edit.from!;
            const toDir = edit.to!;
            let created = copyInto(from, toDir);
            resources.push(created);
            ops.push({
                confirmBeforeUndo: `Удалить вставленный «${path.basename(created)}»?`,
                undo: () => {
                    fs.rmSync(created, { recursive: true, force: true });
                },
                redo: () => {
                    created = copyInto(from, toDir);
                },
            });
        } else if (edit.kind === "delete") {
            const from = edit.from!;
            resources.push(from);
            if (this.willMoveToTrash()) {
                let entry = this.trash.trash(from);
                ops.push({
                    undo: () => {
                        this.trash.restore(entry);
                    },
                    redo: () => {
                        entry = this.trash.trash(from);
                    },
                });
            } else {
                // Безвозвратно — отменить нельзя, шаг в историю не пишем.
                fs.rmSync(from, { recursive: true, force: true });
            }
        } else {
            throw new Error(`Неподдерживаемый вид правки: ${edit.kind}`);
        }
    }
}

/** Возвращает `src` на `originalPath` (или рядом, если место занято). Возвращает итоговый путь. */
function moveBack(src: string, originalPath: string): string {
    let dest = originalPath;
    if (fs.existsSync(dest)) {
        dest = resolveNonConflictingDest(path.dirname(originalPath), path.basename(originalPath));
    }
    moveToPath(src, dest);
    return dest;
}

export const WorkspaceEditServiceDIToken = token<WorkspaceEditService>("WorkspaceEditService");
