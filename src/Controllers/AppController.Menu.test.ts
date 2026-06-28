import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
import type { MenuEntry, MenuItemEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { PopupMenuElement } from "../TUIDom/Widgets/PopupMenuElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface MenuContext {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
}

function createMenuApp(size: Size = new Size(80, 24)): MenuContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);
    const commands = container.get(CommandRegistryDIToken);
    return { testApp, controller, commands };
}

/** Open a top-level menu by mnemonic (Alt+<letter>) and return the live popup element. */
function openMenu(testApp: TestApp, mnemonic: string): PopupMenuElement {
    testApp.sendKey(`Alt+${mnemonic}`);
    const popup = testApp.querySelector("PopupMenuElement") as PopupMenuElement | null;
    expect(popup).not.toBeNull();
    return popup as PopupMenuElement;
}

/** Find an entry by its label inside a popup menu. */
function entryByLabel(popup: PopupMenuElement, label: string): MenuItemEntry {
    const found = popup.entries.find(
        (e): e is MenuItemEntry => e.type !== "separator" && (e as MenuItemEntry).label === label,
    );
    expect(found, `entry "${label}" should exist`).toBeDefined();
    return found as MenuItemEntry;
}

function itemLabels(popup: PopupMenuElement): string[] {
    return popup.entries
        .filter((e): e is MenuItemEntry => e.type !== "separator")
        .map((e) => e.label);
}

describe("AppController — menu bar wiring", () => {
    it("opens the File menu and renders its entries", () => {
        const { testApp } = createMenuApp();
        const popup = openMenu(testApp, "f");
        expect(itemLabels(popup)).toEqual(["Save", "Exit"]);
    });

    it("File → Save runs the save command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "f");

        entryByLabel(popup, "Save").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("workbench.action.files.save");
    });

    it("File → Exit triggers the quit command (and the quit flow)", () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        try {
            const { testApp, commands } = createMenuApp();
            const executeSpy = vi.spyOn(commands, "execute");
            const popup = openMenu(testApp, "f");

            entryByLabel(popup, "Exit").onSelect?.();

            expect(executeSpy).toHaveBeenCalledWith("workbench.action.quit");
            // No unsaved editors → quit proceeds.
            expect(exitSpy).toHaveBeenCalledWith(0);
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("opens the Edit menu and renders its entries", () => {
        const { testApp } = createMenuApp();
        const popup = openMenu(testApp, "e");
        expect(itemLabels(popup)).toEqual(["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]);
    });

    it("Edit → Undo runs the undo command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Undo").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("undo");
    });

    it("Edit → Redo runs the redo command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Redo").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("redo");
    });

    it("Edit → Cut runs the clipboard cut command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Cut").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardCutAction");
    });

    it("Edit → Copy runs the clipboard copy command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Copy").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardCopyAction");
    });

    it("Edit → Paste runs the clipboard paste command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Paste").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardPasteAction");
    });

    it("Edit → Select All runs the select-all command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "e");

        entryByLabel(popup, "Select All").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.selectAll");
    });

    it("opens the Selection menu and renders its entries", () => {
        const { testApp } = createMenuApp();
        const popup = openMenu(testApp, "s");
        expect(itemLabels(popup)).toEqual(["Select All", "Expand Selection (Word)"]);
    });

    it("Selection → Select All runs the select-all command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "s");

        entryByLabel(popup, "Select All").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.selectAll");
    });

    it("Selection → Expand Selection (Word) runs cursorWordRightSelect", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "s");

        entryByLabel(popup, "Expand Selection (Word)").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("cursorWordRightSelect");
    });

    it("opens the View menu and renders its entries", () => {
        const { testApp } = createMenuApp();
        const popup = openMenu(testApp, "v");
        expect(itemLabels(popup)).toEqual(["Explorer", "Toggle Primary Side Bar"]);
    });

    it("View → Explorer runs the explorer command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "v");

        entryByLabel(popup, "Explorer").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("workbench.view.explorer");
    });

    it("View → Toggle Primary Side Bar toggles the left panel visibility", () => {
        const { testApp, controller } = createMenuApp();
        controller.openFile("/tmp/menu-toggle-sidebar.txt");
        testApp.render();
        const layout = testApp.querySelector("WorkbenchLayoutElement") as unknown as {
            getLeftPanelVisible: () => boolean;
        };
        const before = layout.getLeftPanelVisible();

        const popup = openMenu(testApp, "v");
        entryByLabel(popup, "Toggle Primary Side Bar").onSelect?.();

        expect(layout.getLeftPanelVisible()).toBe(!before);
    });

    it("opens the Help menu and renders its entries", () => {
        const { testApp } = createMenuApp();
        const popup = openMenu(testApp, "h");
        expect(itemLabels(popup)).toEqual(["About"]);
    });

    it("Help → About runs the show-about-dialog command", () => {
        const { testApp, commands } = createMenuApp();
        const executeSpy = vi.spyOn(commands, "execute");
        const popup = openMenu(testApp, "h");

        entryByLabel(popup, "About").onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("workbench.action.showAboutDialog");
    });

    it("show-about-dialog command opens the About dialog", () => {
        const { testApp, commands } = createMenuApp();
        expect(testApp.querySelector("AboutDialogElement")).toBeNull();

        commands.execute("workbench.action.showAboutDialog");
        testApp.render();

        expect(testApp.querySelector("AboutDialogElement")).not.toBeNull();
    });

    it("reuses the About dialog on reopen and closes it via its callback", () => {
        const { testApp, commands } = createMenuApp();

        commands.execute("workbench.action.showAboutDialog");
        testApp.render();
        const dialog = testApp.querySelector("AboutDialogElement");
        expect(dialog).not.toBeNull();

        // Reopening reuses the same dialog instance (covers the not-null branch).
        commands.execute("workbench.action.showAboutDialog");
        testApp.render();
        expect(testApp.querySelector("AboutDialogElement")).toBe(dialog);

        // Closing through the dialog's onClose callback hides it without error.
        expect(() => (dialog as unknown as { onClose?: () => void }).onClose?.()).not.toThrow();
    });

    it("menu bar element is present in the DOM", () => {
        const { testApp } = createMenuApp();
        expect(testApp.querySelector("MenuBarElement")).not.toBeNull();
    });

    it("selecting a menu item closes the popup", () => {
        const { testApp } = createMenuApp();
        const menuBar = testApp.querySelector("MenuBarElement") as MenuBarElement;
        openMenu(testApp, "f");
        expect(menuBar.isMenuOpen).toBe(true);

        // The menu bar wraps onSelect to deactivate; drive it through the bar UI.
        testApp.sendKey("Enter"); // activate the first highlighted entry (Save)

        expect(menuBar.isMenuOpen).toBe(false);
    });
});

describe("AppController — editor context menu", () => {
    function getEditorEntries(testApp: TestApp): MenuEntry[] {
        const editor = testApp.querySelector("EditorElement") as EditorElement;
        return editor.contextMenuEntries;
    }

    it("populates editor context menu entries when an editor is created", () => {
        const { testApp, controller } = createMenuApp();
        controller.openFile("/tmp/menu-ctx-create.txt");
        testApp.render();

        const labels = getEditorEntries(testApp)
            .filter((e): e is MenuItemEntry => e.type !== "separator")
            .map((e) => e.label);
        expect(labels).toEqual(["Copy", "Cut", "Paste", "Undo"]);
    });

    it("editor context menu Copy entry runs the copy command", () => {
        const { testApp, controller, commands } = createMenuApp();
        controller.openFile("/tmp/menu-ctx-copy.txt");
        testApp.render();
        const executeSpy = vi.spyOn(commands, "execute");

        const copy = getEditorEntries(testApp).find(
            (e): e is MenuItemEntry => e.type !== "separator" && (e as MenuItemEntry).label === "Copy",
        ) as MenuItemEntry;
        copy.onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardCopyAction");
    });

    it("editor context menu Cut entry runs the cut command", () => {
        const { testApp, controller, commands } = createMenuApp();
        controller.openFile("/tmp/menu-ctx-cut.txt");
        testApp.render();
        const executeSpy = vi.spyOn(commands, "execute");

        const cut = getEditorEntries(testApp).find(
            (e): e is MenuItemEntry => e.type !== "separator" && (e as MenuItemEntry).label === "Cut",
        ) as MenuItemEntry;
        cut.onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardCutAction");
    });

    it("editor context menu Paste entry runs the paste command", () => {
        const { testApp, controller, commands } = createMenuApp();
        controller.openFile("/tmp/menu-ctx-paste.txt");
        testApp.render();
        const executeSpy = vi.spyOn(commands, "execute");

        const paste = getEditorEntries(testApp).find(
            (e): e is MenuItemEntry => e.type !== "separator" && (e as MenuItemEntry).label === "Paste",
        ) as MenuItemEntry;
        paste.onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("editor.action.clipboardPasteAction");
    });

    it("editor context menu Undo entry runs the undo command", () => {
        const { testApp, controller, commands } = createMenuApp();
        controller.openFile("/tmp/menu-ctx-undo.txt");
        testApp.render();
        const executeSpy = vi.spyOn(commands, "execute");

        const undo = getEditorEntries(testApp).find(
            (e): e is MenuItemEntry => e.type !== "separator" && (e as MenuItemEntry).label === "Undo",
        ) as MenuItemEntry;
        undo.onSelect?.();

        expect(executeSpy).toHaveBeenCalledWith("undo");
    });
});
