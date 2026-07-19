import * as nodePath from "node:path";

import { token } from "../../../Common/DiContainer.ts";
import type { CommandRegistry } from "../CommandRegistry.ts";
import { CommandRegistryDIToken } from "../CommandRegistry.ts";
import type { FileSearchResult, FileSearchService } from "../FileSearchService.ts";
import { FileSearchServiceDIToken } from "../FileSearchService.ts";
import type { ParsedGoto } from "../QuickOpenParsing.ts";
import { splitFileQuery } from "../QuickOpenParsing.ts";

import type { IGotoLineEditorSource } from "./GotoLineQuickAccessProvider.ts";
import { GotoLineEditorSourceDIToken, navigateActiveEditor } from "./GotoLineQuickAccessProvider.ts";
import type { IQuickAccessProvider, QuickAccessItem } from "./IQuickAccessProvider.ts";

export const FilesQuickAccessProviderDIToken = token<FilesQuickAccessProvider>("FilesQuickAccessProvider");

/**
 * Дефолтный (файловый) провайдер Quick Open: fuzzy-поиск поверх
 * {@link FileSearchService} с поддержкой суффикса `file:line[:col]`. Индекс
 * строится в фоне — пока показ открыт, провайдер живо обновляет список по мере
 * роста индекса; ввод дорогой, поэтому запросы дебаунсятся (`debounceQuery`).
 */
export class FilesQuickAccessProvider implements IQuickAccessProvider {
    public static readonly PREFIX = "";

    public static dependencies = [
        FileSearchServiceDIToken,
        CommandRegistryDIToken,
        GotoLineEditorSourceDIToken,
    ] as const;

    public readonly debounceQuery = true;

    public constructor(
        private readonly fileSearch: FileSearchService,
        private readonly commands: CommandRegistry,
        private readonly editorSource: IGotoLineEditorSource,
    ) {}

    public getPlaceholder(): string {
        return "Go to File...";
    }

    public onShow(refresh: (preserveSelection: boolean) => void): void {
        // Kick a throttled background re-index and refresh the list live as
        // it grows (the index builds in the background, not on a watcher).
        this.fileSearch.refreshIfStale();
        this.fileSearch.onIndexChanged = () => {
            // The list grew in the background for the same query — refresh the
            // results without resetting the cursor the user is navigating.
            refresh(true);
        };
    }

    public onHide(): void {
        this.fileSearch.onIndexChanged = null;
    }

    public getItems(query: string): QuickAccessItem[] {
        const { filePart, goto } = splitFileQuery(query);
        return this.buildFileItems(this.fileSearch.search(filePart, 50), goto);
    }

    private buildFileItems(results: FileSearchResult[], goto: ParsedGoto | null): QuickAccessItem[] {
        return results.map((r) => {
            const basename = nodePath.basename(r.entry.relativePath);
            const dir = nodePath.dirname(r.entry.relativePath);

            // Split matchedIndices into basename vs. directory ranges for highlighting
            const basenameOffset = r.entry.relativePath.length - basename.length;
            const labelRanges: [number, number][] = [];
            const descRanges: [number, number][] = [];

            for (const idx of r.matchedIndices) {
                if (idx >= basenameOffset) {
                    const localIdx = idx - basenameOffset;
                    if (labelRanges.length > 0 && labelRanges[labelRanges.length - 1][1] === localIdx) {
                        labelRanges[labelRanges.length - 1][1]++;
                    } else {
                        labelRanges.push([localIdx, localIdx + 1]);
                    }
                } else {
                    if (descRanges.length > 0 && descRanges[descRanges.length - 1][1] === idx) {
                        descRanges[descRanges.length - 1][1]++;
                    } else {
                        descRanges.push([idx, idx + 1]);
                    }
                }
            }

            const absolutePath = r.entry.absolutePath;
            return {
                label: basename,
                description: dir === "." ? "" : dir,
                labelMatchRanges: labelRanges,
                descriptionMatchRanges: descRanges,
                accept: () => {
                    this.commands.execute("workbench.openFile", absolutePath);
                    // Read the active editor *after* the file opened above so a
                    // `file:line` accept jumps in the just-opened editor.
                    if (goto !== null) {
                        navigateActiveEditor(this.editorSource, goto.line, goto.column);
                    }
                },
            };
        });
    }
}
