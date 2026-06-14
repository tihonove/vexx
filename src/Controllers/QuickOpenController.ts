import * as nodePath from "node:path";

import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/ContextMenuLayer.ts";
import type { QuickPickItem } from "../TUIDom/Widgets/QuickPickElement.ts";
import { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";

import type { CommandRegistry } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import type { FileSearchResult, FileSearchService } from "./FileSearchService.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { formatKeybinding } from "./KeybindingRegistry.ts";

type OpenMode = "files" | "commands";

// QuickPickItem extended with routing metadata (not rendered by the widget)
interface QuickPickItemWithMeta extends QuickPickItem {
    absolutePath?: string;
    commandId?: string;
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

    public onExecuteCommand: ((id: string, ...args: unknown[]) => void) | null = null;

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
        this.quickOpenSession = body.contextMenuLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
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
            this.view.placeholder = "Show All Commands";
        } else {
            this.view.setQuery("");
            this.view.placeholder = "Go to File...";
            // Kick a throttled background re-index and refresh the list live as
            // it grows (the index builds in the background, not on a watcher).
            this.fileSearch.refreshIfStale();
            this.fileSearch.onIndexChanged = () => this.handleIndexChanged();
        }

        this.updatePosition();
        this.updateItems(this.view.getQuery());

        this.quickOpenSession?.open();
        this.view.focus();
    }

    public close(): void {
        if (!this.quickOpenSession?.isOpen()) return;
        this.fileSearch.onIndexChanged = null;
        this.quickOpenSession.close();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private handleIndexChanged(): void {
        if (this.currentMode !== "files") return;
        if (!this.quickOpenSession?.isOpen()) return;
        this.updateItems(this.view.getQuery());
    }

    private handleQueryChange(query: string): void {
        const isCommandMode = query.startsWith(">");
        if (isCommandMode !== (this.currentMode === "commands")) {
            this.currentMode = isCommandMode ? "commands" : "files";
        }
        this.updateItems(query);
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
            }
        });
    }

    private updateItems(query: string): void {
        if (query.startsWith(">")) {
            this.view.items = this.buildCommandItems(query.slice(1).trimStart());
        } else {
            this.view.items = this.buildFileItems(this.fileSearch.search(query, 50));
        }
    }

    private buildFileItems(results: FileSearchResult[]): QuickPickItem[] {
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
