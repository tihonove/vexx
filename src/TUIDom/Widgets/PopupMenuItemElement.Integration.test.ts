import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Size } from "../../Common/GeometryPromitives.ts";
import { TuiApplication } from "../TuiApplication.ts";

import { BodyElement } from "./BodyElement.ts";
import { BoxElement } from "./BoxElement.ts";
import type { MenuBarItem } from "./MenuBarElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";

function createApp(
    width = 40,
    height = 10,
): {
    backend: MockTerminalBackend;
    app: TuiApplication;
    body: BodyElement;
} {
    const backend = new MockTerminalBackend(new Size(width, height));
    const app = new TuiApplication(backend);
    const body = new BodyElement();
    app.root = body;
    return { backend, app, body };
}

function simulateClick(backend: MockTerminalBackend, x: number, y: number): void {
    backend.simulateMouse({
        kind: "mouse",
        button: "left",
        action: "press",
        x: x + 1,
        y: y + 1,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        raw: "",
    });
    backend.simulateMouse({
        kind: "mouse",
        button: "left",
        action: "release",
        x: x + 1,
        y: y + 1,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        raw: "",
    });
}

describe("PopupMenuItemElement integration — full app with mouse clicks", () => {
    it("clicking a popup menu item triggers onSelect", () => {
        const { backend, app, body } = createApp();

        const onCut = vi.fn();
        const onCopy = vi.fn();
        const onPaste = vi.fn();

        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                entries: [
                    { label: "Cut", onSelect: onCut },
                    { label: "Copy", onSelect: onCopy },
                    { label: "Paste", onSelect: onPaste },
                ],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        body.setMenuBar(menuBar);
        body.setContent(new BoxElement());
        app.run();

        // Click on "File" in the menu bar (row 0, column ~2)
        simulateClick(backend, 2, 0);

        // The menu should now be open
        expect(menuBar.isMenuOpen).toBe(true);

        // Click on "Cut" — row 2, inside the menu
        simulateClick(backend, 2, 2);

        expect(onCut).toHaveBeenCalledOnce();
    });

    it("clicking second menu item triggers its onSelect", () => {
        const { backend, app, body } = createApp();

        const onCut = vi.fn();
        const onCopy = vi.fn();

        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                entries: [
                    { label: "Cut", onSelect: onCut },
                    { label: "Copy", onSelect: onCopy },
                ],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        body.setMenuBar(menuBar);
        body.setContent(new BoxElement());
        app.run();

        // Open menu
        simulateClick(backend, 2, 0);
        expect(menuBar.isMenuOpen).toBe(true);

        // Click on "Copy" (row 3)
        simulateClick(backend, 2, 3);

        expect(onCut).not.toHaveBeenCalled();
        expect(onCopy).toHaveBeenCalledOnce();
    });

    it("keyboard Enter on popup menu item triggers onSelect", () => {
        const { backend, app, body } = createApp();

        const onCut = vi.fn();
        const onCopy = vi.fn();

        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                entries: [
                    { label: "Cut", onSelect: onCut },
                    { label: "Copy", onSelect: onCopy },
                ],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        body.setMenuBar(menuBar);
        body.setContent(new BoxElement());
        app.run();

        // Open menu by clicking "File"
        simulateClick(backend, 2, 0);
        expect(menuBar.isMenuOpen).toBe(true);

        // First item "Cut" is selected by default, press Enter
        backend.sendKey("Enter");

        expect(onCut).toHaveBeenCalledOnce();
    });
});
