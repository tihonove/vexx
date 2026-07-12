import type { FileTreeController } from "../../Controllers/FileTreeController.ts";

import type { IFileDecorationsService } from "./IFileDecorationsService.ts";

/**
 * Реализация {@link IFileDecorationsService} поверх {@link FileTreeController}.
 * Живёт в слое Extensions (Controllers ничего не знает про host).
 */
export class FileDecorationsServiceAdapter implements IFileDecorationsService {
    private readonly fileTree: FileTreeController;

    public constructor(fileTree: FileTreeController) {
        this.fileTree = fileTree;
    }

    public setFileDecorations(entries: readonly { path: string; color?: number; badge?: string }[]): void {
        this.fileTree.setFileDecorations(entries);
    }
}
