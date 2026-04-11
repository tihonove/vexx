import { describe, expect, it } from "vitest";

import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext } from "../TUIElement.ts";

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
            if (!element) return roots;
            return element.children ?? [];
        },
        getKey(element: TestNode): string {
            return element.id;
        },
    };
}

function renderTree(
    tree: TreeViewElement<TestNode>,
    width: number,
    height: number,
): MockTerminalBackend {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    tree.globalPosition = new Point(0, 0);
    tree.performLayout(BoxConstraints.tight(size));
    const clipRect = new Rect(new Point(0, 0), size);
    tree.render(new RenderContext(termScreen, new Offset(0, 0), clipRect));
    termScreen.flush(backend);
    return backend;
}

describe("TreeViewElement rendering", () => {
    it("renders flat list of items", async () => {
        const roots: TestNode[] = [
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta" },
            { id: "c", label: "Gamma" },
        ];
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();

        const backend = renderTree(tree, 12, 3);
        // Each row: expandIcon(" ") + " " + label
        const actual = backend.screenToString().split("\n").map((l) => l.trimEnd());
        expect(actual[0]).toBe("  Alpha");
        expect(actual[1]).toBe("  Beta");
        expect(actual[2]).toBe("  Gamma");
    });

    it("renders collapsible items with collapsed icon", async () => {
        const roots: TestNode[] = [
            { id: "dir", label: "src", children: [{ id: "f", label: "main.ts" }] },
            { id: "readme", label: "README.md" },
        ];
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();

        const backend = renderTree(tree, 14, 2);
        // ▸ = collapsed icon for collapsible, space for non-collapsible
        expectScreen(
            backend,
            screen`
                \u25B8 src
                  README.md
            `,
        );
    });

    it("renders expanded items with children indented", async () => {
        const roots: TestNode[] = [
            {
                id: "dir",
                label: "src",
                children: [
                    { id: "f1", label: "main.ts" },
                    { id: "f2", label: "util.ts" },
                ],
            },
        ];
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();
        await tree.toggleExpand(roots[0]);

        const backend = renderTree(tree, 16, 3);
        // ▾ = expanded icon, children indented by 2
        expectScreen(
            backend,
            screen`
                \u25BE src
                    main.ts
                    util.ts
            `,
        );
    });

    it("renders deeply nested expanded tree", async () => {
        const roots: TestNode[] = [
            {
                id: "a",
                label: "root",
                children: [
                    {
                        id: "b",
                        label: "mid",
                        children: [
                            { id: "c", label: "leaf" },
                        ],
                    },
                ],
            },
        ];
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();
        await tree.toggleExpand(roots[0]);
        await tree.toggleExpand(roots[0].children![0]);

        const backend = renderTree(tree, 16, 3);
        expectScreen(
            backend,
            screen`
                \u25BE root
                  \u25BE mid
                      leaf
            `,
        );
    });

    it("renders empty lines below content", async () => {
        const roots: TestNode[] = [
            { id: "a", label: "One" },
        ];
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();

        const backend = renderTree(tree, 8, 3);
        // One row of content, 2 empty rows
        const lines = backend.screenToString().split("\n");
        // First line has content
        expect(lines[0]).toContain("One");
    });

    it("renders with scroll offset", async () => {
        const roots: TestNode[] = [];
        for (let i = 0; i < 10; i++) {
            roots.push({ id: `${i}`, label: `Item${i}` });
        }
        const tree = new TreeViewElement(createProvider(roots));
        await tree.refresh();

        // Layout first so scrollTo can clamp properly
        const size = new Size(12, 3);
        tree.globalPosition = new Point(0, 0);
        tree.performLayout(BoxConstraints.tight(size));
        tree.scrollTo(0, 5);

        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        const clipRect = new Rect(new Point(0, 0), size);
        tree.render(new RenderContext(termScreen, new Offset(0, 0), clipRect));
        termScreen.flush(backend);

        // Each row: expandIcon(" ") + " " + label
        const actual = backend.screenToString().split("\n").map((l) => l.trimEnd());
        expect(actual[0]).toBe("  Item5");
        expect(actual[1]).toBe("  Item6");
        expect(actual[2]).toBe("  Item7");
    });
});
