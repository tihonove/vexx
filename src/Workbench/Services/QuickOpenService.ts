import * as nodePath from "node:path";

import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import type { QuickPickElement, QuickPickItem } from "../../TUIDom/Widgets/QuickPickElement.ts";

import type { QuickInputComponent } from "../Components/QuickInput/QuickInputComponent.ts";
import { QuickInputComponentDIToken } from "../Components/QuickInput/QuickInputComponent.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { FileSearchResult, FileSearchService } from "./FileSearchService.ts";
import { FileSearchServiceDIToken } from "./FileSearchService.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import type { ParsedGoto } from "./QuickOpenParsing.ts";
import { parseGotoLineQuery, splitFileQuery } from "./QuickOpenParsing.ts";

export type QuickOpenMode = "files" | "commands" | "line";

/**
 * The active editor as seen by Go-to-Line. Structurally satisfied by
 * editor pane; kept as a narrow interface so the service does not depend
 * on the whole editor. All values are 0-based (document coordinates).
 */
export interface IGotoLineEditor {
    readonly lineCount: number;
    readonly primaryCursorLine: number;
    readonly primaryCursorColumn: number;
    goToPosition(line: number, column?: number): void;
}

/**
 * Источник активного редактора для Go-to-Line (`:`-режим и `file:line`).
 * Интерфейсный шов: `EditorService` соответствует ему
 * структурно; биндинг — в `Workbench/Modules/WorkbenchModule.ts`. Читается
 * лениво — accept `file:line` берёт редактор *после* открытия файла, так что
 * прыжок происходит в свежеактивированном редакторе.
 */
export interface IGotoLineEditorSource {
    getActiveEditor(): IGotoLineEditor | null;
}

export const GotoLineEditorSourceDIToken = token<IGotoLineEditorSource>("GotoLineEditorSource");

/**
 * Debounce window for file-mode search. A single keystroke after an idle period
 * runs synchronously (leading edge); rapid bursts coalesce into one trailing run
 * so typing stays smooth on huge trees.
 */
const SEARCH_DEBOUNCE_MS = 16;

// QuickPickItem extended with routing metadata (not rendered by the widget)
interface QuickPickItemWithMeta extends QuickPickItem {
    absolutePath?: string;
    commandId?: string;
    /** 1-based line to navigate to after accept (active editor, or the opened file). */
    gotoLine?: number;
    /** 1-based column to navigate to; defaults to the line start when absent. */
    gotoColumn?: number;
}

export const QuickOpenServiceDIToken = token<QuickOpenService>("QuickOpenService");

/**
 * Quick Open (Ctrl+P): файловый поиск поверх {@link FileSearchService},
 * command palette (`>`) и goto-line (`:`). UI — общий виджет
 * {@link QuickInputComponent}; на каждый показ сервис полностью
 * ре-инициализирует состояние и колбэки виджета (соседний клиент —
 * `QuickInputService` — делает то же). Принятие файла/команды уходит в
 * {@link CommandRegistry} (`workbench.openFile` / id команды).
 */
export class QuickOpenService extends Disposable {
    public static dependencies = [
        FileSearchServiceDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ContextKeyServiceDIToken,
        GotoLineEditorSourceDIToken,
        QuickInputComponentDIToken,
    ] as const;

    private currentMode: QuickOpenMode = "files";
    /** Владеем ли текущим показом общего виджета (сессию мог занять QuickInputService). */
    private active = false;

    /** Active cooldown timer for the file-search debounce; null when idle. */
    private searchTimer: ReturnType<typeof setTimeout> | null = null;
    /** Latest file query awaiting a trailing run, or null if none pending. */
    private pendingQuery: string | null = null;

    public constructor(
        private readonly fileSearch: FileSearchService,
        private readonly commands: CommandRegistry,
        private readonly keybindings: KeybindingRegistry,
        private readonly contextKeys: ContextKeyService,
        private readonly editorSource: IGotoLineEditorSource,
        private readonly component: QuickInputComponent,
    ) {
        super();
    }

    private get view(): QuickPickElement {
        return this.component.view;
    }

    public open(mode: QuickOpenMode): void {
        if (this.active && this.component.isOpen()) {
            this.view.focus();
            return;
        }
        // Общий виджет мог держать чужой показ (InputBox/список QuickInputService) —
        // закрываем его (его промис отменится через onDidClose) перед перехватом.
        this.component.hide();

        this.currentMode = mode;
        this.active = true;

        const view = this.view;
        // Полный ре-инит общего виджета под Quick Open.
        view.maxVisibleItems = 10;
        view.acceptMode = "item";
        view.title = undefined;
        view.prompt = undefined;
        view.validationMessage = null;
        view.onAcceptValue = null;
        view.onActiveItemChanged = null;
        view.onQueryChange = (query) => {
            this.handleQueryChange(query);
        };
        view.onAccept = (item) => {
            this.handleAccept(item);
        };
        view.onCancel = () => {
            this.close();
        };
        this.component.onDidClose = () => {
            // Клик мимо / Escape / программное закрытие — единый путь зачистки.
            this.handleDidClose();
        };

        if (mode === "commands") {
            view.setQuery(">");
        } else if (mode === "line") {
            view.setQuery(":");
        } else {
            view.setQuery("");
            // Kick a throttled background re-index and refresh the list live as
            // it grows (the index builds in the background, not on a watcher).
            this.fileSearch.refreshIfStale();
            this.fileSearch.onIndexChanged = () => {
                this.handleIndexChanged();
            };
        }
        this.applyPlaceholder(mode);

        this.updateItems(view.getQuery());

        this.component.show();
    }

    public close(): void {
        if (!this.active || !this.component.isOpen()) return;
        // Зачистка (отписка от индекса, отмена debounce) — в handleDidClose,
        // куда onDidClose приводит и этот программный путь.
        this.component.hide();
    }

    public override dispose(): void {
        this.cancelPendingSearch();
        super.dispose();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private handleDidClose(): void {
        this.active = false;
        this.cancelPendingSearch();
        this.fileSearch.onIndexChanged = null;
    }

    private handleIndexChanged(): void {
        if (this.currentMode !== "files") return;
        if (!this.active || !this.component.isOpen()) return;
        // The list grew in the background for the same query — refresh the
        // results without resetting the cursor the user is navigating.
        this.updateItems(this.view.getQuery(), true);
    }

    private handleQueryChange(query: string): void {
        const mode = detectMode(query);
        if (mode !== this.currentMode) {
            this.currentMode = mode;
            this.applyPlaceholder(mode);
        }

        // Command and line modes are cheap (tiny synchronous item list) — run
        // them immediately and drop any pending file search.
        if (this.currentMode !== "files") {
            this.cancelPendingSearch();
            this.updateItems(query);
            return;
        }

        // File mode: leading + trailing debounce. Idle → run now (leading) and
        // start a cooldown; within the cooldown → remember the latest query and
        // let the trailing run pick it up.
        if (this.searchTimer === null) {
            this.updateItems(query);
            this.armSearchTimer();
        } else {
            this.pendingQuery = query;
        }
    }

    private armSearchTimer(): void {
        this.searchTimer = setTimeout(() => {
            this.searchTimer = null;
            if (this.pendingQuery === null) return;
            const query = this.pendingQuery;
            this.pendingQuery = null;
            this.updateItems(query);
            // Keep coalescing if the user is still typing.
            this.armSearchTimer();
        }, SEARCH_DEBOUNCE_MS);
    }

    private cancelPendingSearch(): void {
        if (this.searchTimer !== null) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        this.pendingQuery = null;
    }

    private handleAccept(item: QuickPickItem): void {
        const meta = item as QuickPickItemWithMeta;

        queueMicrotask(() => {
            if (meta.commandId !== undefined) {
                this.close();
                this.commands.execute(meta.commandId);
            } else if (meta.absolutePath !== undefined) {
                this.close();
                this.commands.execute("workbench.openFile", meta.absolutePath);
                // Read the active editor *after* the file opened above so a
                // `file:line` accept jumps in the just-opened editor.
                if (meta.gotoLine !== undefined) {
                    this.navigateActiveEditor(meta.gotoLine, meta.gotoColumn);
                }
            } else if (meta.gotoLine !== undefined) {
                // Pure Go-to-Line (`:` mode): jump in the current editor.
                this.close();
                this.navigateActiveEditor(meta.gotoLine, meta.gotoColumn);
            }
            // Otherwise an info-only item (e.g. "type a line number") — no-op,
            // keep the picker open so the user can keep typing.
        });
    }

    /** Jumps the active editor to a 1-based line/column, converting to 0-based. */
    private navigateActiveEditor(line: number, column: number | undefined): void {
        const editor = this.editorSource.getActiveEditor();
        if (editor === null) return;
        editor.goToPosition(line - 1, column !== undefined ? column - 1 : 0);
    }

    private updateItems(query: string, preserveSelection = false): void {
        const items = this.buildItems(query);

        if (preserveSelection) {
            this.view.refreshItems(items);
        } else {
            this.view.items = items;
        }
    }

    private buildItems(query: string): QuickPickItem[] {
        if (query.startsWith(">")) {
            return this.buildCommandItems(query.slice(1).trimStart());
        }
        if (query.startsWith(":")) {
            return this.buildLineItems(query);
        }
        const { filePart, goto } = splitFileQuery(query);
        return this.buildFileItems(this.fileSearch.search(filePart, 50), goto);
    }

    /**
     * Builds the single row shown in Go-to-Line mode: an actionable "Go to line
     * N" once a number is typed, otherwise an info hint. VS Code shows the same
     * one-line affordance instead of a list.
     */
    private buildLineItems(query: string): QuickPickItem[] {
        const editor = this.editorSource.getActiveEditor();
        if (editor === null) {
            return [{ label: "No active editor to navigate" }];
        }

        const goto = parseGotoLineQuery(query);
        if (goto === null) {
            return [{ label: `Type a line number between 1 and ${editor.lineCount} to navigate to` }];
        }

        const columnSuffix = goto.column !== undefined ? `:${goto.column}` : "";
        const lineItem: QuickPickItemWithMeta = {
            label: `Go to line ${goto.line}${columnSuffix}`,
            gotoLine: goto.line,
            gotoColumn: goto.column,
        };
        return [lineItem];
    }

    private buildFileItems(results: FileSearchResult[], goto: ParsedGoto | null): QuickPickItem[] {
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

            const fileItem: QuickPickItemWithMeta = {
                label: basename,
                description: dir === "." ? "" : dir,
                labelMatchRanges: labelRanges,
                descriptionMatchRanges: descRanges,
                absolutePath: r.entry.absolutePath,
                gotoLine: goto?.line,
                gotoColumn: goto?.column,
            };
            return fileItem;
        });
    }

    private buildCommandItems(filter: string): QuickPickItem[] {
        const all = this.commands.listCommands();
        const filterLower = filter.toLowerCase();

        const matched = filterLower === "" ? all : all.filter((cmd) => cmd.title.toLowerCase().includes(filterLower));

        return matched.map((cmd): QuickPickItemWithMeta => {
            const chord = this.keybindings.getKeybindingForCommand(cmd.id, this.contextKeys);
            return {
                label: cmd.title,
                commandId: cmd.id,
                shortcut: chord ? formatKeybinding(chord) : undefined,
            };
        });
    }

    private applyPlaceholder(mode: QuickOpenMode): void {
        if (mode === "commands") {
            this.view.placeholder = "Show All Commands";
        } else if (mode === "line") {
            this.view.placeholder = this.gotoLinePlaceholder();
        } else {
            this.view.placeholder = "Go to File...";
        }
    }

    /** VS Code-style hint for Go-to-Line mode, showing the current position. */
    private gotoLinePlaceholder(): string {
        const editor = this.editorSource.getActiveEditor();
        if (editor === null) return "Go to line";
        const line = editor.primaryCursorLine + 1;
        const character = editor.primaryCursorColumn + 1;
        return `Current Line: ${line}, Character: ${character}. Type a line number between 1 and ${editor.lineCount} to navigate to.`;
    }
}

/** Picks the Quick Open mode from the query's leading sigil (`>` / `:`). */
function detectMode(query: string): QuickOpenMode {
    if (query.startsWith(">")) return "commands";
    if (query.startsWith(":")) return "line";
    return "files";
}
