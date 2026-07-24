import * as path from "node:path";

import type { ITreeDataProvider, ITreeItem } from "../../../../../../tuidom/ui/tree/iTreeDataProvider.ts";

import type { IScmChange } from "./changesService.ts";

/** Узел вкладки Changes — один изменённый файл (список плоский, без группировки). */
export type ChangeNode = IScmChange;

/**
 * Данные плоского списка изменённых файлов. Провайдер-агностик: держит снимок,
 * выданный ему {@link setChanges}, а контроллер обновляет его по
 * `ScmChangesService.onDidChangeChanges`. Метка — путь относительно корня
 * воркспейса (если он задан), иначе basename; цвет буквы-статуса — из карты
 * `colorId → RGB`, которую пушит контроллер из темы.
 */
export class ChangesTreeDataProvider implements ITreeDataProvider<ChangeNode> {
    /** Корень воркспейса для относительных меток; null → показываем basename. */
    public rootPath: string | null = null;
    /** `gitDecoration.*` id → упакованный RGB, из темы (пушит контроллер). */
    public statusColors: Record<string, number> = {};
    public onChange?: (element?: ChangeNode) => void;

    private changeList: readonly ChangeNode[] = [];

    /** Заменяет содержимое списка снимком изменений (сортировка — по пути, стабильно). */
    public setChanges(changes: readonly IScmChange[]): void {
        this.changeList = [...changes].sort((a, b) => a.uri.toString().localeCompare(b.uri.toString()));
    }

    public getChildren(element?: ChangeNode): ChangeNode[] {
        // Плоский список: дети есть только у корня.
        return element === undefined ? [...this.changeList] : [];
    }

    public getTreeItem(element: ChangeNode): ITreeItem {
        return {
            label: this.label(element),
            collapsible: false,
            badge: element.status,
            labelColor: this.statusColors[element.colorId],
        };
    }

    public getKey(element: ChangeNode): string {
        return element.uri.toString();
    }

    /** Путь относительно корня воркспейса; вне корня/без корня — basename. */
    private label(element: ChangeNode): string {
        const fsPath = element.uri.fsPath;
        if (this.rootPath !== null) {
            const rel = path.relative(this.rootPath, fsPath);
            if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
        }
        return path.basename(fsPath);
    }
}
