import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../../Common/DiContainer.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../Configuration/IConfigurationServiceDIToken.ts";
import { copyInto, moveInto, moveToPath, resolveNonConflictingDest } from "../Actions/fileClipboardFs.ts";

import type { IUndoRedoElement } from "../../Workbench/Services/Workspace/IUndoRedoElement.ts";
import { TrashService, TrashServiceDIToken } from "./TrashService.ts";
import { UndoRedoService, UndoRedoServiceDIToken, WORKSPACE_UNDO_CONTEXT } from "../../Workbench/Services/Workspace/UndoRedoService.ts";
import type { ResourceFileEdit } from "../../Workbench/Services/Workspace/WorkspaceEdit.ts";

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

    private readonly undoRedo: UndoRedoService;
    private readonly trash: TrashService;
    private readonly config: IConfigurationService;

    public constructor(undoRedo: UndoRedoService, trash: TrashService, config: IConfigurationService) {
        this.undoRedo = undoRedo;
        this.trash = trash;
        this.config = config;
    }

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
            undo() {
                for (let i = ops.length - 1; i >= 0; i--) ops[i].undo();
            },
            redo() {
                for (const op of ops) op.redo();
            },
        };
        this.undoRedo.pushElement(element, WORKSPACE_UNDO_CONTEXT);
        return element;
    }

    private applyOne(edit: ResourceFileEdit, ops: ReversibleOp[], resources: string[]): void {
        // Защита от значения, пришедшего в обход типов (kind типизирован строкой намеренно,
        // чтобы проверка не считалась «всегда истинной» и оставалась осмысленной в рантайме).
        const kind: string = edit.kind;
        if (kind !== "move" && kind !== "rename" && kind !== "copy" && kind !== "delete" && kind !== "create") {
            throw new Error(`Неподдерживаемый вид правки: ${kind}`);
        }

        if (edit.kind === "move") {
            const from = edit.from;
            const toDir = edit.to;
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
        } else if (edit.kind === "rename") {
            // В отличие от move, `to` — точный целевой путь (переименование на месте),
            // а не каталог-назначение. Коллизию отсекает валидация в промпте.
            const from = edit.from;
            const to = edit.to;
            moveToPath(from, to);
            let current = to;
            resources.push(from, to);
            ops.push({
                undo: () => {
                    current = moveBack(current, from);
                },
                redo: () => {
                    moveToPath(current, to);
                    current = to;
                },
            });
        } else if (edit.kind === "copy") {
            const from = edit.from;
            const toDir = edit.to;
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
            const from = edit.from;
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
            const to = edit.to;
            // Явное имя от пользователя: коллизия — жёсткая ошибка (перехватывается
            // per-edit try/catch → чистый no-op, в историю ничего не пишем). Реальная
            // защита от коллизий — валидация в промпте создания.
            if (fs.existsSync(to)) throw new Error(`Уже существует: ${to}`);

            // Самый верхний из создаваемых предков — чтобы undo убрал ровно то, что
            // добавило create (и не тронул уже существовавшие каталоги).
            const createdRoot = shallowestMissingAncestor(to);
            const doCreate = (): void => {
                fs.mkdirSync(path.dirname(to), { recursive: true });
                if (edit.directory) fs.mkdirSync(to);
                else fs.writeFileSync(to, "");
            };
            doCreate();
            resources.push(to);
            ops.push({
                undo: () => {
                    fs.rmSync(createdRoot, { recursive: true, force: true });
                },
                redo: () => {
                    doCreate();
                },
            });
        }
    }
}

/** Ближайший к корню несуществующий предок `target` (или сам target). */
function shallowestMissingAncestor(target: string): string {
    let current = target;
    let parent = path.dirname(current);
    while (parent !== current && !fs.existsSync(parent)) {
        current = parent;
        parent = path.dirname(current);
    }
    return current;
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
