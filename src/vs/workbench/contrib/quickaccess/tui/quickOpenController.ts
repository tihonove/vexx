import * as nodePath from "node:path";

import { Disposable } from "../../../../base/common/lifecycle.ts";
import { Point } from "../../../../base/common/geometry.ts";
import { BodyElement } from "../../../../base/tui/bodyElement.ts";
import type { OverlaySessionHandle } from "../../../../base/tui/ui/contextview/overlayLayer.ts";
import type { QuickPickItem } from "../../../../platform/quickinput/tui/quickPickElement.ts";
import { QuickPickElement } from "../../../../platform/quickinput/tui/quickPickElement.ts";

import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ContextKeyService } from "../../../../platform/contextkey/common/contextKeyService.ts";
import type { FileSearchResult, FileSearchService } from "../../../services/search/node/fileSearchService.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { formatKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { ParsedGoto } from "../common/quickOpenParsing.ts";
import { parseGotoLineQuery, splitFileQuery } from "../common/quickOpenParsing.ts";

type OpenMode = "files" | "commands" | "line";

/**
 * The active editor as seen by Go-to-Line. Structurally satisfied by
 * {@link import("../../../tui/parts/editor/editorController.ts").EditorController}; kept as a narrow
 * interface so the controller does not depend on the whole editor. All values
 * are 0-based (document coordinates).
 */
export interface IGotoLineEditor {
    readonly lineCount: number;
    readonly primaryCursorLine: number;
    readonly primaryCursorColumn: number;
    goToPosition(line: number, column?: number): void;
}

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

export class QuickOpenController extends Disposable {
    public readonly view: QuickPickElement;

    private readonly fileSearch: FileSearchService;
    private readonly commands: CommandRegistry;
    private readonly keybindings: KeybindingRegistry;
    private readonly contextKeys: ContextKeyService;
    private hostBody: BodyElement | null = null;
    private quickOpenSession: OverlaySessionHandle | null = null;
    private currentMode: OpenMode = "files";

    /** Active cooldown timer for the file-search debounce; null when idle. */
    private searchTimer: ReturnType<typeof setTimeout> | null = null;
    /** Latest file query awaiting a trailing run, or null if none pending. */
    private pendingQuery: string | null = null;

    public onExecuteCommand: ((id: string, ...args: unknown[]) => void) | null = null;

    /**
     * Resolves the editor targeted by Go-to-Line (`:` mode and `file:line`
     * accepts). Set by {@link import("../../../tui/workbench.ts").AppController} to the
     * active editor. For `file:line` it is read *after* the file opens, so it
     * returns the freshly-activated editor.
     */
    public getActiveEditor: (() => IGotoLineEditor | null) | null = null;

    public constructor(
        fileSearch: FileSearchService,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        contextKeys: ContextKeyService,
    ) {
        super();
        this.fileSearch = fileSearch;
        this.commands = commands;
        this.keybindings = keybindings;
        this.contextKeys = contextKeys;
        this.view = new QuickPickElement();
        this.view.maxVisibleItems = 10;

        this.view.onQueryChange = (query) => {
            this.handleQueryChange(query);
        };
        this.view.onAccept = (item) => {
            this.handleAccept(item);
        };
        this.view.onCancel = () => {
            this.close();
        };
    }

    public setHostView(body: BodyElement): void {
        this.hostBody = body;
        this.quickOpenSession = body.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            pointerPolicy: "close-on-outside",
        });

        this.register({
            dispose: () => {
                this.quickOpenSession?.dispose();
                this.quickOpenSession = null;
            },
        });
    }

    public open(mode: OpenMode): void {
        if (this.quickOpenSession?.isOpen()) {
            this.view.focus();
            return;
        }

        this.currentMode = mode;

        if (mode === "commands") {
            this.view.setQuery(">");
        } else if (mode === "line") {
            this.view.setQuery(":");
        } else {
            this.view.setQuery("");
            // Kick a throttled background re-index and refresh the list live as
            // it grows (the index builds in the background, not on a watcher).
            this.fileSearch.refreshIfStale();
            this.fileSearch.onIndexChanged = () => {
                this.handleIndexChanged();
            };
        }
        this.applyPlaceholder(mode);

        this.updatePosition();
        this.updateItems(this.view.getQuery());

        this.quickOpenSession?.open();
        this.view.focus();
    }

    public close(): void {
        if (!this.quickOpenSession?.isOpen()) return;
        this.cancelPendingSearch();
        this.fileSearch.onIndexChanged = null;
        this.quickOpenSession.close();
    }

    public override dispose(): void {
        this.cancelPendingSearch();
        super.dispose();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private handleIndexChanged(): void {
        if (this.currentMode !== "files") return;
        if (!this.quickOpenSession?.isOpen()) return;
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
                this.onExecuteCommand?.(meta.commandId);
            } else if (meta.absolutePath !== undefined) {
                this.close();
                this.onExecuteCommand?.("workbench.openFile", meta.absolutePath);
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
        const editor = this.getActiveEditor?.() ?? null;
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
        const editor = this.getActiveEditor?.() ?? null;
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

    private applyPlaceholder(mode: OpenMode): void {
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
        const editor = this.getActiveEditor?.() ?? null;
        if (editor === null) return "Go to line";
        const line = editor.primaryCursorLine + 1;
        const character = editor.primaryCursorColumn + 1;
        return `Current Line: ${line}, Character: ${character}. Type a line number between 1 and ${editor.lineCount} to navigate to.`;
    }

    private updatePosition(): void {
        if (!this.hostBody) return;

        const screenW = this.hostBody.layoutSize.width;
        const screenH = this.hostBody.layoutSize.height;

        const pickerW = Math.min(80, Math.max(40, screenW - 4));
        const px = Math.max(0, Math.floor((screenW - pickerW) / 2));
        // Sit just below the menu bar (row 1)
        const py = Math.max(1, Math.floor(screenH * 0.1));

        this.view.preferredWidth = pickerW;
        this.quickOpenSession?.setPosition(new Point(px, py));
    }
}

/** Picks the Quick Open mode from the query's leading sigil (`>` / `:`). */
function detectMode(query: string): OpenMode {
    if (query.startsWith(">")) return "commands";
    if (query.startsWith(":")) return "line";
    return "files";
}
