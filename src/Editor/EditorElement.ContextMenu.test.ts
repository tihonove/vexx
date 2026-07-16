import { describe, expect, it, vi } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { IThemeFile } from "../Theme/IThemeFile.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import { PopupMenuElement } from "../TUIDom/Widgets/PopupMenuElement.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(text: string, width = 40, height = 10): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    return { app, editor };
}

function fireMouseDown(editor: EditorElement, localX: number, localY: number, button: "left" | "right" = "left"): void {
    editor.dispatchEvent(
        new TUIMouseEvent("mousedown", {
            button,
            screenX: localX,
            screenY: localY,
            localX,
            localY,
        }),
    );
}

describe("EditorElement — right-click context menu", () => {
    it("shows popup menu on right-click when contextMenuEntries are configured", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }, { label: "Paste" }];

        fireMouseDown(editor, 5, 0, "right");

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("does not show popup when contextMenuEntries is empty", () => {
        const { app, editor } = createEditor("hello world");

        fireMouseDown(editor, 5, 0, "right");

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("popup contains a PopupMenuElement", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }];

        fireMouseDown(editor, 5, 0, "right");

        const items = app.root.overlayLayer.getItems();
        expect(items.length).toBe(1);
        expect(items[0].element).toBeInstanceOf(PopupMenuElement);
    });

    it("popup closes when clicking outside", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }];

        fireMouseDown(editor, 5, 0, "right");
        expect(app.root.overlayLayer.hasVisibleItems()).toBe(true);

        // Click elsewhere (left-click on the editor at a different position)
        fireMouseDown(editor, 2, 2, "left");

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("popup closes when a menu item is selected", () => {
        const { app, editor } = createEditor("hello world");
        const onSelect = vi.fn();
        editor.contextMenuEntries = [{ label: "Copy", onSelect }];

        fireMouseDown(editor, 5, 0, "right");
        expect(app.root.overlayLayer.hasVisibleItems()).toBe(true);

        const menuEl = app.root.overlayLayer.getItems()[0].element as PopupMenuElement;
        const firstEntry = menuEl.entries[0] as { onSelect?: () => void };
        firstEntry.onSelect?.();

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("calls the original onSelect handler after closing", () => {
        const { app, editor } = createEditor("hello world");
        const onSelect = vi.fn();
        editor.contextMenuEntries = [{ label: "Copy", onSelect }];

        fireMouseDown(editor, 5, 0, "right");
        const menuEl = app.root.overlayLayer.getItems()[0].element as PopupMenuElement;
        const firstEntry = menuEl.entries[0] as { onSelect?: () => void };
        firstEntry.onSelect?.();

        expect(onSelect).toHaveBeenCalledOnce();
    });

    it("does not move cursor on right-click", () => {
        const { editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }];

        const initialPos = editor.viewState.selections[0].active;

        fireMouseDown(editor, 10, 0, "right");

        expect(editor.viewState.selections[0].active).toEqual(initialPos);
    });

    it("second right-click replaces existing popup", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }];

        fireMouseDown(editor, 5, 0, "right");
        fireMouseDown(editor, 10, 0, "right");

        expect(app.root.overlayLayer.getItems().length).toBe(1);
    });

    it("applies menuTheme colors to the context menu popup", () => {
        const { app, editor } = createEditor("hello world");
        const theme = WorkbenchTheme.fromThemeFile({
            colors: { "menu.background": "#123456" },
        } as unknown as IThemeFile);
        editor.menuTheme = theme;
        editor.contextMenuEntries = [{ label: "Copy" }];

        fireMouseDown(editor, 5, 0, "right");
        app.render();

        const item = app.root.overlayLayer.getItems()[0];
        // Top-left rounded corner cell carries the themed menu.background.
        const bg = app.backend.getBgAt(new Point(item.position.x, item.position.y));
        expect(bg).toBe(packRgb(0x12, 0x34, 0x56));
    });

    it("popup is positioned at the click coordinates", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }];

        fireMouseDown(editor, 7, 3, "right");

        const item = app.root.overlayLayer.getItems()[0];
        expect(item.position.x).toBe(7);
        expect(item.position.y).toBe(3);
    });
});

describe("EditorElement — keyboard context menu (Shift+F10)", () => {
    it("opens the popup menu at the caret when entries are configured", () => {
        const { app, editor } = createEditor("hello world");
        editor.contextMenuEntries = [{ label: "Copy" }, { label: "Paste" }];
        editor.viewState.selections = [createCursorSelection(0, 6)];

        editor.openContextMenuAtCaret();

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(true);
        const item = app.root.overlayLayer.getItems()[0];
        const caret = editor.getCaretScreenCell();
        expect(caret).not.toBeNull();
        expect(item.position.x).toBe(caret!.x);
        expect(item.position.y).toBe(caret!.y);
    });

    it("does not open a popup when contextMenuEntries is empty", () => {
        const { app, editor } = createEditor("hello world");

        editor.openContextMenuAtCaret();

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("falls back to the editor's top-left when the caret is scrolled out of view", () => {
        const { app, editor } = createEditor("line0\nline1\nline2\nline3\nline4\nline5", 40, 3);
        editor.contextMenuEntries = [{ label: "Copy" }];
        // Move the caret far down, then scroll so it leaves the viewport.
        editor.viewState.selections = [createCursorSelection(5, 0)];
        editor.viewState.scrollTop = 0;
        expect(editor.getCaretScreenCell()).toBeNull();

        editor.openContextMenuAtCaret();

        expect(app.root.overlayLayer.hasVisibleItems()).toBe(true);
        const item = app.root.overlayLayer.getItems()[0];
        expect(item.position.x).toBe(editor.globalPosition.x);
        expect(item.position.y).toBe(editor.globalPosition.y);
    });
});
