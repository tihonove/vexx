import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import type { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import type { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import type { RenderContext } from "../TUIElement.ts";

import type { ITreeDataProvider, ITreeItem } from "./ITreeDataProvider.ts";
import { ScrollableElement, type ScrollViewportInfo } from "./ScrollableElement.ts";

const INDENT_SIZE = 2;
const ICON_EXPANDED = "\u25BE"; // ▾
const ICON_COLLAPSED = "\u25B8"; // ▸
const DEFAULT_ACTIVE_SELECTION_BG = packRgb(4, 57, 94);
const DEFAULT_ACTIVE_SELECTION_FG = packRgb(255, 255, 255);
const DEFAULT_INACTIVE_SELECTION_BG = packRgb(55, 55, 61);
const DEFAULT_INACTIVE_SELECTION_FG = packRgb(204, 204, 204);

interface FlatTreeNode<T> {
    element: T;
    depth: number;
    item: ITreeItem;
    parentKey: string | null;
}

export class TreeViewElement<T> extends ScrollableElement {
    private provider: ITreeDataProvider<T>;
    private expandedKeys = new Set<string>();
    private childrenCache = new Map<string, T[]>();
    private flatNodes: FlatTreeNode<T>[] = [];
    private selectedIndex = 0;
    private hoveredIndex: number | null = null;
    private selectedKeys = new Set<string>();
    private cutKeys = new Set<string>();
    private maxRowWidth = 0;

    // ─── Theme colors ───
    public activeSelectionBg = DEFAULT_ACTIVE_SELECTION_BG;
    public activeSelectionFg = DEFAULT_ACTIVE_SELECTION_FG;
    public inactiveSelectionBg = DEFAULT_INACTIVE_SELECTION_BG;
    public inactiveSelectionFg = DEFAULT_INACTIVE_SELECTION_FG;
    public hoverBg: number | undefined = undefined;
    public hoverFg: number | undefined = undefined;
    public cutFg: number | undefined = undefined;

    public onSelect: ((item: T) => void) | null = null;
    public onActivate: ((item: T) => void) | null = null;
    public onExpandedChanged: ((element: T, expanded: boolean) => void) | null = null;

    public constructor(provider: ITreeDataProvider<T>) {
        super();
        this.tabIndex = 0;
        this.provider = provider;
        this.provider.onChange = (element) => {
            void this.refresh(element);
        };
    }

    public get contentHeight(): number {
        return this.flatNodes.length;
    }

    public get contentWidth(): number {
        return this.maxRowWidth;
    }

    public async refresh(element?: T): Promise<void> {
        const selectedKey = this.getSelectedKey();

        if (element !== undefined) {
            const key = this.provider.getKey(element);
            this.invalidateSubtreeCache(key);
            await this.reloadExpandedChildren(key);
        } else {
            this.childrenCache.clear();
            await this.loadRootChildren();
        }

        this.rebuildFlatList();
        this.restoreSelection(selectedKey);
        this.markDirty();
    }

    public async toggleExpand(element: T): Promise<void> {
        const key = this.provider.getKey(element);
        if (this.expandedKeys.has(key)) {
            this.expandedKeys.delete(key);
            this.onExpandedChanged?.(element, false);
        } else {
            if (!this.childrenCache.has(key)) {
                const children = await this.provider.getChildren(element);
                this.childrenCache.set(key, children);
            }
            this.expandedKeys.add(key);
            this.onExpandedChanged?.(element, true);
        }
        this.rebuildFlatList();
        this.markDirty();
    }

    public setCutKeys(keys: Set<string>): void {
        this.cutKeys = keys;
        this.markDirty();
    }

    public clearCutKeys(): void {
        this.cutKeys.clear();
        this.markDirty();
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "keydown") {
            this.handleKeydown(event as TUIKeyboardEvent);
        } else if (event.type === "click") {
            this.handleClick(event as TUIMouseEvent);
        } else if (event.type === "dblclick") {
            this.handleDblClick(event as TUIMouseEvent);
        } else if (event.type === "wheel") {
            this.handleWheel(event as TUIMouseEvent);
        } else if (event.type === "mousemove") {
            this.handleMouseMove(event as TUIMouseEvent);
        } else if (event.type === "mouseleave") {
            this.handleMouseLeave();
        } else {
            super.performDefaultAction(event);
        }
    }

    protected override renderViewport(context: RenderContext, viewport: ScrollViewportInfo): void {
        const { scrollTop, scrollLeft, viewportWidth, viewportHeight } = viewport;
        const resolved = this.resolvedStyle;
        const focused = this.isFocused;

        for (let screenY = 0; screenY < viewportHeight; screenY++) {
            const nodeIndex = scrollTop + screenY;

            if (nodeIndex >= this.flatNodes.length) {
                for (let x = 0; x < viewportWidth; x++) {
                    context.setCell(x, screenY, { char: " ", fg: resolved.fg, bg: resolved.bg });
                }
                continue;
            }

            const node = this.flatNodes[nodeIndex];
            const nodeKey = this.provider.getKey(node.element);
            const isCursor = nodeIndex === this.selectedIndex;
            const isSelected = this.selectedKeys.has(nodeKey);
            const isHovered = nodeIndex === this.hoveredIndex;
            const isCut = this.cutKeys.has(nodeKey);

            const { bg: rowBg, fg: rowFg } = this.resolveRowColors(
                resolved, focused, isCursor, isSelected, isHovered, isCut,
            );

            const rowText = this.formatRow(node);
            const rowIcon = node.item.icon;
            const rowIconColor = node.item.iconColor;

            let screenX = 0;
            for (let charIdx = scrollLeft; charIdx < scrollLeft + viewportWidth; charIdx++) {
                if (charIdx < rowText.length) {
                    const char = rowText[charIdx];
                    let fg = rowFg;

                    // Color the icon character
                    const iconStart = node.depth * INDENT_SIZE + 2;
                    if (rowIcon && rowIconColor !== undefined && charIdx === iconStart) {
                        fg = rowIconColor;
                    }

                    // Color the expand icon
                    const expandIconPos = node.depth * INDENT_SIZE;
                    if (charIdx === expandIconPos && node.item.collapsible) {
                        fg = packRgb(150, 150, 150);
                    }

                    context.setCell(screenX, screenY, { char, fg, bg: rowBg });
                } else {
                    context.setCell(screenX, screenY, { char: " ", fg: resolved.fg, bg: rowBg });
                }
                screenX++;
            }
        }
    }

    private resolveRowColors(
        resolved: { fg: number; bg: number },
        focused: boolean,
        isCursor: boolean,
        isSelected: boolean,
        isHovered: boolean,
        isCut: boolean,
    ): { bg: number; fg: number } {
        // Priority: cursor/selection > hover > cut > normal
        if (isCursor || isSelected) {
            if (focused) {
                return { bg: this.activeSelectionBg, fg: this.activeSelectionFg };
            }
            return { bg: this.inactiveSelectionBg, fg: this.inactiveSelectionFg };
        }
        if (isHovered && this.hoverBg !== undefined) {
            return { bg: this.hoverBg, fg: this.hoverFg ?? resolved.fg };
        }
        if (isCut && this.cutFg !== undefined) {
            return { bg: resolved.bg, fg: this.cutFg };
        }
        return { bg: resolved.bg, fg: resolved.fg };
    }

    // ─── Private: data loading ───

    private async loadRootChildren(): Promise<void> {
        const rootChildren = await this.provider.getChildren();
        this.childrenCache.set("__root__", rootChildren);

        for (const key of this.expandedKeys) {
            await this.reloadExpandedChildren(key);
        }
    }

    private async reloadExpandedChildren(key: string): Promise<void> {
        if (!this.expandedKeys.has(key)) return;

        const node = this.findElementByKey(key);
        if (node === null) return;

        const children = await this.provider.getChildren(node);
        this.childrenCache.set(key, children);

        for (const child of children) {
            const childKey = this.provider.getKey(child);
            if (this.expandedKeys.has(childKey)) {
                await this.reloadExpandedChildren(childKey);
            }
        }
    }

    private invalidateSubtreeCache(key: string): void {
        const children = this.childrenCache.get(key);
        if (children) {
            for (const child of children) {
                const childKey = this.provider.getKey(child);
                this.invalidateSubtreeCache(childKey);
            }
        }
        this.childrenCache.delete(key);
    }

    // ─── Private: flat list ───

    private rebuildFlatList(): void {
        this.flatNodes = [];
        this.maxRowWidth = 0;
        const rootChildren = this.childrenCache.get("__root__");
        if (!rootChildren) return;

        this.appendChildren(rootChildren, 0, null);
    }

    private appendChildren(children: T[], depth: number, parentKey: string | null): void {
        for (const element of children) {
            const key = this.provider.getKey(element);
            const item = this.provider.getTreeItem(element);
            this.flatNodes.push({ element, depth, item, parentKey });

            const rowWidth = this.calculateRowWidth(depth, item);
            if (rowWidth > this.maxRowWidth) {
                this.maxRowWidth = rowWidth;
            }

            if (this.expandedKeys.has(key)) {
                const cachedChildren = this.childrenCache.get(key);
                if (cachedChildren) {
                    this.appendChildren(cachedChildren, depth + 1, key);
                }
            }
        }
    }

    private calculateRowWidth(depth: number, item: ITreeItem): number {
        // indent + expandIcon + space + icon + space + label
        return depth * INDENT_SIZE + 2 + (item.icon ? 2 : 0) + item.label.length;
    }

    private formatRow(node: FlatTreeNode<T>): string {
        const indent = " ".repeat(node.depth * INDENT_SIZE);
        const expandIcon = node.item.collapsible
            ? this.expandedKeys.has(this.provider.getKey(node.element))
                ? ICON_EXPANDED
                : ICON_COLLAPSED
            : " ";
        const icon = node.item.icon ? node.item.icon + " " : "";
        return `${indent}${expandIcon} ${icon}${node.item.label}`;
    }

    // ─── Private: selection ───

    private getSelectedKey(): string | null {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.flatNodes.length) {
            return this.provider.getKey(this.flatNodes[this.selectedIndex].element);
        }
        return null;
    }

    private restoreSelection(key: string | null): void {
        if (key === null) {
            this.selectedIndex = 0;
            return;
        }
        const idx = this.flatNodes.findIndex((n) => this.provider.getKey(n.element) === key);
        this.selectedIndex = idx >= 0 ? idx : 0;
    }

    public focusPageDown(): void {
        const pageSize = Math.max(1, this.layoutSize.height - 1);
        this.setSelectedIndex(this.selectedIndex + pageSize);
    }

    public focusPageUp(): void {
        const pageSize = Math.max(1, this.layoutSize.height - 1);
        this.setSelectedIndex(this.selectedIndex - pageSize);
    }

    private setSelectedIndex(index: number): void {
        if (index < 0) index = 0;
        if (index >= this.flatNodes.length) index = this.flatNodes.length - 1;
        if (index < 0) return;

        this.selectedIndex = index;
        this.ensureVisible(index);
        this.onSelect?.(this.flatNodes[index].element);
        this.markDirty();
    }

    private ensureVisible(index: number): void {
        const viewportHeight = this.layoutSize.height;
        if (index < this.scrollTop) {
            this.scrollTo(this.scrollLeft, index);
        } else if (index >= this.scrollTop + viewportHeight) {
            this.scrollTo(this.scrollLeft, index - viewportHeight + 1);
        }
    }

    // ─── Private: key helpers ───

    private findElementByKey(key: string): T | null {
        for (const node of this.flatNodes) {
            if (this.provider.getKey(node.element) === key) {
                return node.element;
            }
        }
        // Search in cache values too
        for (const children of this.childrenCache.values()) {
            for (const child of children) {
                if (this.provider.getKey(child) === key) {
                    return child;
                }
            }
        }
        return null;
    }

    // ─── Private: input handlers ───

    private handleKeydown(event: TUIKeyboardEvent): void {
        switch (event.key) {
            case "ArrowUp":
                this.setSelectedIndex(this.selectedIndex - 1);
                break;
            case "ArrowDown":
                this.setSelectedIndex(this.selectedIndex + 1);
                break;
            case "ArrowRight":
                void this.handleExpandOrMoveToChild();
                break;
            case "ArrowLeft":
                void this.handleCollapseOrMoveToParent();
                break;
            case "Enter":
                this.activateSelected();
                break;
            case " ":
                void this.toggleSelected();
                break;
            default:
                return;
        }
    }

    private async handleExpandOrMoveToChild(): Promise<void> {
        const node = this.flatNodes[this.selectedIndex];

        if (node.item.collapsible) {
            const key = this.provider.getKey(node.element);
            if (!this.expandedKeys.has(key)) {
                await this.toggleExpand(node.element);
            } else {
                // Already expanded — move to first child
                if (this.selectedIndex + 1 < this.flatNodes.length) {
                    const nextNode = this.flatNodes[this.selectedIndex + 1];
                    if (nextNode.depth > node.depth) {
                        this.setSelectedIndex(this.selectedIndex + 1);
                    }
                }
            }
        }
    }

    private async handleCollapseOrMoveToParent(): Promise<void> {
        const node = this.flatNodes[this.selectedIndex];

        const key = this.provider.getKey(node.element);
        if (node.item.collapsible && this.expandedKeys.has(key)) {
            await this.toggleExpand(node.element);
        } else if (node.parentKey !== null) {
            const parentIdx = this.flatNodes.findIndex((n) => this.provider.getKey(n.element) === node.parentKey);
            if (parentIdx >= 0) {
                this.setSelectedIndex(parentIdx);
            }
        }
    }

    private activateSelected(): void {
        const node = this.flatNodes[this.selectedIndex];
        this.onActivate?.(node.element);
    }

    private async toggleSelected(): Promise<void> {
        const node = this.flatNodes[this.selectedIndex];
        if (!node.item.collapsible) return;
        await this.toggleExpand(node.element);
    }

    private handleClick(event: TUIMouseEvent): void {
        const index = this.scrollTop + event.localY;
        if (index < 0 || index >= this.flatNodes.length) return;

        this.setSelectedIndex(index);

        // Check if clicked on expand icon area
        const node = this.flatNodes[index];
        const expandIconX = node.depth * INDENT_SIZE;
        const clickX = this.scrollLeft + event.localX;
        if (node.item.collapsible && clickX >= expandIconX && clickX <= expandIconX + 1) {
            void this.toggleExpand(node.element);
        }
    }

    private handleDblClick(event: TUIMouseEvent): void {
        const index = this.scrollTop + event.localY;
        if (index < 0 || index >= this.flatNodes.length) return;

        const node = this.flatNodes[index];
        if (node.item.collapsible) {
            void this.toggleExpand(node.element);
        } else {
            this.onActivate?.(node.element);
        }
    }

    private handleMouseMove(event: TUIMouseEvent): void {
        const index = this.scrollTop + event.localY;
        const newHovered = index >= 0 && index < this.flatNodes.length ? index : null;
        if (newHovered !== this.hoveredIndex) {
            this.hoveredIndex = newHovered;
            this.markDirty();
        }
    }

    private handleMouseLeave(): void {
        if (this.hoveredIndex !== null) {
            this.hoveredIndex = null;
            this.markDirty();
        }
    }

    private handleWheel(event: TUIMouseEvent): void {
        if (event.wheelDirection === "up") {
            this.scrollBy(0, -3);
        } else if (event.wheelDirection === "down") {
            this.scrollBy(0, 3);
        }
        this.markDirty();
    }
}
