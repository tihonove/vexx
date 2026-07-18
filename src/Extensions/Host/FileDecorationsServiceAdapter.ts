import type { IFileDecorationsService } from "./IFileDecorationsService.ts";

/**
 * Минимальный срез Explorer'а, нужный мосту декораций: полная замена набора
 * статус-декораций файлов. `ExplorerService` (Workbench) соответствует ему
 * структурно — слой Extensions не тянет конкретный сервис.
 */
export interface IFileDecorationsTarget {
    setFileDecorations(entries: readonly { path: string; color?: number; badge?: string }[]): void;
}

/**
 * Реализация {@link IFileDecorationsService} поверх {@link IFileDecorationsTarget}
 * (в продакшене — `ExplorerService`). Живёт в слое Extensions (Workbench ничего
 * не знает про host).
 */
export class FileDecorationsServiceAdapter implements IFileDecorationsService {
    private readonly explorer: IFileDecorationsTarget;

    public constructor(explorer: IFileDecorationsTarget) {
        this.explorer = explorer;
    }

    public setFileDecorations(entries: readonly { path: string; color?: number; badge?: string }[]): void {
        this.explorer.setFileDecorations(entries);
    }
}
