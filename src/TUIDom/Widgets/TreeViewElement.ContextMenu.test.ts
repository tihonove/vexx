import { describe, expect, it, vi } from "vitest";

import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";

import type { ITreeDataProvider, ITreeItem } from "./ITreeDataProvider.ts";
import { TreeViewElement } from "./TreeViewElement.ts";

interface TestNode {
    id: string;
    label: string;
    children?: TestNode[];
}

function createProvider(roots: TestNode[]): ITreeDataProvider<TestNode> {
    return {
        getTreeItem(element: TestNode): ITreeItem {
            return {
                label: element.label,
                collapsible: (element.children?.length ?? 0) > 0,
            };
        },
        getChildren(element?: TestNode): TestNode[] {
            return element ? (element.children ?? []) : roots;
        },
        getKey(element: TestNode): string {
            return element.id;
        },
    };
}

const FLAT_NODES: TestNode[] = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
];

function createTree(roots: TestNode[], viewportSize = new Size(40, 10)) {
    const provider = createProvider(roots);
    const tree = new TreeViewElement(provider);
    const app = TestApp.createWithContent(tree, viewportSize);
    tree.globalPosition = new Point(0, 0);
    tree.performLayout(BoxConstraints.tight(viewportSize));
    tree.focus();
    return { tree, app, provider, refresh: () => tree.refresh() };
}

function makeClickEvent(opts: {
    button?: "left" | "right";
    screenX: number;
    screenY: number;
    localX?: number;
    localY?: number;
}) {
    return new TUIMouseEvent("click", {
        button: opts.button ?? "left",
        screenX: opts.screenX,
        screenY: opts.screenY,
        localX: opts.localX ?? opts.screenX,
        localY: opts.localY ?? opts.screenY,
    });
}

describe("TreeViewElement - context menu (right-click)", () => {
    it("right-click fires onContextMenu with the correct element", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onContextMenu = vi.fn();
        tree.onContextMenu = onContextMenu;

        tree.dispatchEvent(makeClickEvent({ button: "right", screenX: 5, screenY: 1 }));

        expect(onContextMenu).toHaveBeenCalledOnce();
        const [element] = onContextMenu.mock.calls[0] as [TestNode, number, number];
        expect(element).toBe(FLAT_NODES[1]); // row 1 → Beta
    });

    it("right-click passes correct screenX and screenY to onContextMenu", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onContextMenu = vi.fn();
        tree.onContextMenu = onContextMenu;

        tree.dispatchEvent(makeClickEvent({ button: "right", screenX: 12, screenY: 2 }));

        expect(onContextMenu).toHaveBeenCalledWith(FLAT_NODES[2], 12, 2);
    });

    it("right-click selects the clicked row", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onContextMenu = vi.fn();
        tree.onContextMenu = onContextMenu;

        tree.dispatchEvent(makeClickEvent({ button: "right", screenX: 5, screenY: 0 }));

        // Verify onContextMenu was called for row 0 (Alpha), which means the row was selected
        expect(onContextMenu).toHaveBeenCalledOnce();
        const [element] = onContextMenu.mock.calls[0] as [TestNode, number, number];
        expect(element).toBe(FLAT_NODES[0]);
    });

    it("right-click does NOT call onActivate", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onActivate = vi.fn();
        tree.onActivate = onActivate;
        tree.onContextMenu = vi.fn();

        tree.dispatchEvent(makeClickEvent({ button: "right", screenX: 5, screenY: 0 }));

        expect(onActivate).not.toHaveBeenCalled();
    });

    it("right-click on out-of-bounds row does NOT fire onContextMenu", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onContextMenu = vi.fn();
        tree.onContextMenu = onContextMenu;

        // Row 99 is way beyond the 3-item list
        tree.dispatchEvent(makeClickEvent({ button: "right", screenX: 5, screenY: 99 }));

        expect(onContextMenu).not.toHaveBeenCalled();
    });

    it("left-click still triggers onActivate via double-click, not onContextMenu", async () => {
        const { tree, refresh } = createTree(FLAT_NODES);
        await refresh();
        const onContextMenu = vi.fn();
        tree.onContextMenu = onContextMenu;

        tree.dispatchEvent(makeClickEvent({ button: "left", screenX: 5, screenY: 0 }));

        expect(onContextMenu).not.toHaveBeenCalled();
    });
});
