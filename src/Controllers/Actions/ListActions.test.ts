import { describe, expect, it, vi } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import type { ITreeDataProvider, ITreeItem } from "../../TUIDom/Widgets/ITreeDataProvider.ts";
import { TreeViewElement } from "../../TUIDom/Widgets/TreeViewElement.ts";
import { registerAction } from "../../Workbench/Actions/CommandAction.ts";
import { CommandRegistry } from "../../Workbench/Services/CommandRegistry.ts";
import { TuiApplicationDIToken } from "../../Workbench/Services/CoreTokens.ts";
import { KeybindingRegistry } from "../../Workbench/Services/KeybindingRegistry.ts";

import {
    listFocusFirstAction,
    listFocusLastAction,
    listFocusPageDownAction,
    listFocusPageUpAction,
} from "./ListActions.ts";

interface Node {
    id: string;
    label: string;
}

function provider(items: Node[]): ITreeDataProvider<Node> {
    return {
        getTreeItem(el: Node): ITreeItem {
            return { label: el.label, collapsible: false };
        },
        getChildren(el?: Node): Node[] {
            return el ? [] : items;
        },
        getKey(el: Node): string {
            return el.id;
        },
    };
}

const ITEMS: Node[] = Array.from({ length: 30 }, (_, i) => ({ id: `i${String(i)}`, label: `Item ${String(i)}` }));

async function mountFocusedTree() {
    const tree = new TreeViewElement(provider(ITEMS));
    const app = TestApp.createWithContent(tree, new Size(40, 10)); // viewportHeight ≈ 10 → page = 9
    tree.focus();
    await tree.refresh();
    app.render();

    const accessor = new Container();
    accessor.bind(TuiApplicationDIToken, () => app.app);
    const commands = new CommandRegistry();
    function exec(action: typeof listFocusPageDownAction): void {
        registerAction(commands, new KeybindingRegistry(), accessor, action);
        commands.execute(action.id);
    }
    return { tree, app, accessor, exec };
}

describe("ListActions — drive the focused TreeViewElement", () => {
    it("list.focusPageDown pages the focused tree down by viewportHeight - 1", async () => {
        const { tree, exec } = await mountFocusedTree();
        const selected = vi.fn();
        tree.onSelect = selected;

        exec(listFocusPageDownAction);

        expect(selected).toHaveBeenLastCalledWith(ITEMS[9]);
    });

    it("list.focusPageUp pages the focused tree back up", async () => {
        const { tree, exec } = await mountFocusedTree();
        exec(listFocusPageDownAction); // move to index 9 first
        const selected = vi.fn();
        tree.onSelect = selected;

        exec(listFocusPageUpAction);

        expect(selected).toHaveBeenLastCalledWith(ITEMS[0]);
    });

    it("list.focusLast jumps the focused tree to the last item", async () => {
        const { tree, exec } = await mountFocusedTree();
        const selected = vi.fn();
        tree.onSelect = selected;

        exec(listFocusLastAction);

        expect(selected).toHaveBeenLastCalledWith(ITEMS[ITEMS.length - 1]);
    });

    it("list.focusFirst jumps the focused tree back to the first item", async () => {
        const { tree, exec } = await mountFocusedTree();
        exec(listFocusLastAction); // move to the end first
        const selected = vi.fn();
        tree.onSelect = selected;

        exec(listFocusFirstAction);

        expect(selected).toHaveBeenLastCalledWith(ITEMS[0]);
    });
});

describe("ListActions — when the focused element is not a tree", () => {
    it("list.focusPageDown is a safe no-op", async () => {
        // Tree exists but is not focused → focusManager.activeElement is not a TreeViewElement.
        const tree = new TreeViewElement(provider(ITEMS));
        const app = TestApp.createWithContent(tree, new Size(40, 10));
        await tree.refresh();
        app.render();
        const selected = vi.fn();
        tree.onSelect = selected;

        const accessor = new Container();
        accessor.bind(TuiApplicationDIToken, () => app.app);
        const commands = new CommandRegistry();
        registerAction(commands, new KeybindingRegistry(), accessor, listFocusPageDownAction);

        expect(() => commands.execute(listFocusPageDownAction.id)).not.toThrow();
        expect(selected).not.toHaveBeenCalled();
    });

    it("list.focusPageUp is a safe no-op (line 28 guard)", async () => {
        const tree = new TreeViewElement(provider(ITEMS));
        const app = TestApp.createWithContent(tree, new Size(40, 10));
        await tree.refresh();
        app.render();
        const selected = vi.fn();
        tree.onSelect = selected;

        const accessor = new Container();
        accessor.bind(TuiApplicationDIToken, () => app.app);
        const commands = new CommandRegistry();
        registerAction(commands, new KeybindingRegistry(), accessor, listFocusPageUpAction);

        expect(() => commands.execute(listFocusPageUpAction.id)).not.toThrow();
        expect(selected).not.toHaveBeenCalled();
    });

    it("list.focusFirst and list.focusLast are safe no-ops", async () => {
        const tree = new TreeViewElement(provider(ITEMS));
        const app = TestApp.createWithContent(tree, new Size(40, 10));
        await tree.refresh();
        app.render();
        const selected = vi.fn();
        tree.onSelect = selected;

        const accessor = new Container();
        accessor.bind(TuiApplicationDIToken, () => app.app);
        const commands = new CommandRegistry();
        registerAction(commands, new KeybindingRegistry(), accessor, listFocusFirstAction);
        registerAction(commands, new KeybindingRegistry(), accessor, listFocusLastAction);

        expect(() => commands.execute(listFocusFirstAction.id)).not.toThrow();
        expect(() => commands.execute(listFocusLastAction.id)).not.toThrow();
        expect(selected).not.toHaveBeenCalled();
    });
});
