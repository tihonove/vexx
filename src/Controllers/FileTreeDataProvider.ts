import * as fs from "node:fs";
import * as path from "node:path";

import chokidar, { type FSWatcher } from "chokidar";

import { Disposable } from "../Common/Disposable.ts";
import { getFileIcon } from "../Common/FileIcons.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ITreeDataProvider, ITreeItem } from "../TUIDom/Widgets/ITreeDataProvider.ts";

const FOLDER_ICON = "\uF115";
const FOLDER_ICON_COLOR = packRgb(220, 180, 80);

const EXCLUDED_NAMES = new Set(["node_modules", ".git", ".DS_Store"]);

export interface FileTreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
}

export class FileTreeDataProvider extends Disposable implements ITreeDataProvider<FileTreeNode> {
    private rootPath: string;
    private watchers = new Map<string, FSWatcher>();
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    public onChange?: (element?: FileTreeNode) => void;

    public constructor(rootPath: string) {
        super();
        this.rootPath = rootPath;
    }

    public getTreeItem(element: FileTreeNode): ITreeItem {
        if (element.isDirectory) {
            return {
                label: element.name,
                icon: FOLDER_ICON,
                iconColor: FOLDER_ICON_COLOR,
                collapsible: true,
            };
        }
        const fileIcon = getFileIcon(element.name);
        return {
            label: element.name,
            icon: fileIcon.icon,
            iconColor: fileIcon.color,
            collapsible: false,
        };
    }

    public getChildren(element?: FileTreeNode): FileTreeNode[] {
        const dirPath = element ? element.path : this.rootPath;
        return this.readDirectory(dirPath);
    }

    public getKey(element: FileTreeNode): string {
        return element.path;
    }

    public watchDirectory(dirPath: string): void {
        if (this.watchers.has(dirPath)) return;

        const watcher = chokidar.watch(dirPath, {
            depth: 0,
            ignoreInitial: true,
            ignored: (filePath: string) => {
                const name = path.basename(filePath);
                return EXCLUDED_NAMES.has(name);
            },
        });

        watcher.on("all", () => {
            this.debouncedNotify(dirPath);
        });

        this.watchers.set(dirPath, watcher);
    }

    public unwatchDirectory(dirPath: string): void {
        const watcher = this.watchers.get(dirPath);
        if (!watcher) return;

        void watcher.close();
        this.watchers.delete(dirPath);

        const timer = this.debounceTimers.get(dirPath);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(dirPath);
        }
    }

    public override dispose(): void {
        for (const watcher of this.watchers.values()) {
            void watcher.close();
        }
        this.watchers.clear();
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        super.dispose();
    }

    private readDirectory(dirPath: string): FileTreeNode[] {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
            return [];
        }

        const nodes: FileTreeNode[] = [];
        for (const entry of entries) {
            if (EXCLUDED_NAMES.has(entry.name)) continue;
            nodes.push({
                name: entry.name,
                path: path.join(dirPath, entry.name),
                isDirectory: entry.isDirectory(),
            });
        }

        nodes.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return nodes;
    }

    private debouncedNotify(dirPath: string): void {
        const existing = this.debounceTimers.get(dirPath);
        if (existing) clearTimeout(existing);

        this.debounceTimers.set(
            dirPath,
            setTimeout(() => {
                this.debounceTimers.delete(dirPath);
                const node: FileTreeNode = {
                    name: path.basename(dirPath),
                    path: dirPath,
                    isDirectory: true,
                };
                this.onChange?.(node);
            }, 300),
        );
    }
}
