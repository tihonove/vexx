import { describe, expect, it, vi } from "vitest";

import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { TUIKeyboardEvent } from "../../TUIDom/Events/TUIKeyboardEvent.ts";
import type { ButtonElement } from "../../TUIDom/Widgets/ButtonElement.ts";

import { ConfirmSaveDialog } from "./ConfirmSaveDialog.tsx";

function mount(filename = "test.ts") {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const dialog = new ConfirmSaveDialog(themeService, filename);
    dialog.mount();
    const testApp = TestApp.createWithContent(dialog.view, new Size(80, 24));
    const buttons = testApp.querySelectorAll("ButtonElement") as ButtonElement[];
    return { dialog, testApp, buttons };
}

function sendToFocused(testApp: TestApp, key: string): void {
    testApp.focusedElement?.dispatchEvent(new TUIKeyboardEvent("keydown", { key }));
}

describe("ConfirmSaveDialog — focus navigation", () => {
    it("focusDefault focuses the Save button", () => {
        const { dialog, testApp, buttons } = mount();
        dialog.focusDefault();
        expect(testApp.focusedElement).toBe(buttons[2]);
        expect(buttons[2].getLabel()).toBe("Save");
    });

    it("ArrowLeft moves focus toward the first button and stops at the edge", () => {
        const { dialog, testApp, buttons } = mount();
        dialog.focusDefault(); // Save (index 2)

        sendToFocused(testApp, "ArrowLeft");
        expect(testApp.focusedElement).toBe(buttons[1]); // Cancel

        sendToFocused(testApp, "ArrowLeft");
        expect(testApp.focusedElement).toBe(buttons[0]); // Don't Save

        sendToFocused(testApp, "ArrowLeft");
        expect(testApp.focusedElement).toBe(buttons[0]); // stays at the left edge
    });

    it("ArrowRight moves focus toward the last button and stops at the edge", () => {
        const { testApp, buttons } = mount();
        buttons[0].focus(); // Don't Save (index 0)

        sendToFocused(testApp, "ArrowRight");
        expect(testApp.focusedElement).toBe(buttons[1]);

        sendToFocused(testApp, "ArrowRight");
        expect(testApp.focusedElement).toBe(buttons[2]);

        sendToFocused(testApp, "ArrowRight");
        expect(testApp.focusedElement).toBe(buttons[2]); // stays at the right edge
    });
});

describe("ConfirmSaveDialog — actions", () => {
    it("Escape triggers onCancel", () => {
        const { dialog, testApp } = mount();
        const onCancel = vi.fn();
        dialog.onCancel = onCancel;
        dialog.focusDefault();

        sendToFocused(testApp, "Escape");

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it("Enter on each button fires the matching callback", () => {
        const { dialog, testApp, buttons } = mount();
        const onSave = vi.fn();
        const onDontSave = vi.fn();
        const onCancel = vi.fn();
        dialog.onSave = onSave;
        dialog.onDontSave = onDontSave;
        dialog.onCancel = onCancel;

        buttons[0].focus();
        sendToFocused(testApp, "Enter");
        expect(onDontSave).toHaveBeenCalledOnce();

        buttons[1].focus();
        sendToFocused(testApp, "Enter");
        expect(onCancel).toHaveBeenCalledOnce();

        buttons[2].focus();
        sendToFocused(testApp, "Enter");
        expect(onSave).toHaveBeenCalledOnce();
    });
});

describe("ConfirmSaveDialog — keydown dispatched directly to the dialog view", () => {
    it("handles ArrowLeft when the dialog view is the event target", () => {
        const { dialog, testApp, buttons } = mount();
        dialog.focusDefault(); // Save (index 2)

        // Dispatch on the root control directly (target phase) rather than via the focused button.
        dialog.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowLeft" }));

        expect(testApp.focusedElement).toBe(buttons[1]); // Cancel
    });

    it("triggers onCancel on Escape dispatched directly to the dialog view", () => {
        const { dialog } = mount();
        const onCancel = vi.fn();
        dialog.onCancel = onCancel;
        dialog.focusDefault();

        dialog.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));

        expect(onCancel).toHaveBeenCalledOnce();
    });
});

describe("ConfirmSaveDialog — filename display", () => {
    it("setFilename updates the rendered filename", () => {
        const { dialog, testApp } = mount("a.ts");
        dialog.setFilename("renamed.ts");
        testApp.render();
        expect(testApp.backend.screenToString()).toContain("renamed.ts?");
    });

    it("truncates an overly long filename with a leading ellipsis", () => {
        const longName = "x".repeat(100) + "-tail.ts";
        const { testApp } = mount(longName);
        testApp.render();
        const text = testApp.backend.screenToString();
        expect(text).toContain("...");
        expect(text).toContain("-tail.ts?");
        expect(text).not.toContain("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    });
});

describe("ConfirmSaveDialog — theme", () => {
    it("repaints on theme change through the service subscription", () => {
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const dialog = new ConfirmSaveDialog(themeService, "test.ts");
        dialog.mount();
        const buttons = [dialog.view.querySelector("ButtonElement")].filter(Boolean);
        expect(buttons.length).toBe(1);

        const custom = WorkbenchTheme.fromThemeFile({
            name: "test",
            type: "dark",
            colors: { "button.background": "#123456" },
        });
        themeService.setTheme(custom);

        const button = dialog.view.querySelector("ButtonElement") as ButtonElement;
        expect(button.focusedBg).toBe(custom.getRequiredColor("button.background"));
    });

    it("unsubscribes from the theme service on dispose", () => {
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const dialog = new ConfirmSaveDialog(themeService, "test.ts");
        dialog.mount();
        const button = dialog.view.querySelector("ButtonElement") as ButtonElement;
        const before = button.focusedBg;

        dialog.dispose();
        themeService.setTheme(
            WorkbenchTheme.fromThemeFile({
                name: "test",
                type: "dark",
                colors: { "button.background": "#654321" },
            }),
        );

        expect(button.focusedBg).toBe(before);
    });
});
