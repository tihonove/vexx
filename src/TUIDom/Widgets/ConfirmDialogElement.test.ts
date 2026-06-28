import { describe, expect, it, vi } from "vitest";

import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";

import { ButtonElement } from "./ButtonElement.ts";
import { ConfirmDialogElement, type ConfirmDialogOptions } from "./ConfirmDialogElement.tsx";

function mount(options: Partial<ConfirmDialogOptions> = {}) {
    const dialog = new ConfirmDialogElement({
        title: "Delete",
        message: "Delete «x.txt»?",
        confirmLabel: "Move to Trash",
        ...options,
    });
    const testApp = TestApp.createWithContent(dialog, new Size(80, 24));
    const buttons = testApp.querySelectorAll("ButtonElement") as ButtonElement[];
    return { dialog, testApp, buttons };
}

function sendToFocused(testApp: TestApp, key: string): void {
    testApp.focusedElement?.dispatchEvent(new TUIKeyboardEvent("keydown", { key }));
}

describe("ConfirmDialogElement", () => {
    it("renders the title, message and button labels", () => {
        const { testApp } = mount({ message: ["line one", "line two"] });
        testApp.render();
        const screen = testApp.backend.screenToString();
        expect(screen).toContain("Delete");
        expect(screen).toContain("line one");
        expect(screen).toContain("line two");
        expect(screen).toContain("Move to Trash");
        expect(screen).toContain("Cancel");
    });

    it("focusDefault focuses Cancel by default", () => {
        const { dialog, testApp, buttons } = mount();
        dialog.focusDefault();
        expect(testApp.focusedElement).toBe(buttons[1]);
        expect(buttons[1].getLabel()).toBe("Cancel");
    });

    it("focusDefault focuses Confirm when requested", () => {
        const { dialog, testApp, buttons } = mount({ defaultButton: "confirm" });
        dialog.focusDefault();
        expect(testApp.focusedElement).toBe(buttons[0]);
    });

    it("Enter on the confirm button fires onConfirm", () => {
        const { dialog, testApp, buttons } = mount();
        const onConfirm = vi.fn();
        dialog.onConfirm = onConfirm;
        buttons[0].focus();
        sendToFocused(testApp, "Enter");
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("Escape fires onCancel", () => {
        const { dialog, testApp } = mount();
        const onCancel = vi.fn();
        dialog.onCancel = onCancel;
        dialog.focusDefault();
        sendToFocused(testApp, "Escape");
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it("Arrow keys move focus between the two buttons", () => {
        const { dialog, testApp, buttons } = mount();
        dialog.focusDefault(); // Cancel (index 1)
        sendToFocused(testApp, "ArrowLeft");
        expect(testApp.focusedElement).toBe(buttons[0]);
        sendToFocused(testApp, "ArrowRight");
        expect(testApp.focusedElement).toBe(buttons[1]);
    });

    it("uses a custom cancel label", () => {
        const { buttons } = mount({ confirmLabel: "Yes", cancelLabel: "No" });
        expect(buttons[0].getLabel()).toBe("Yes");
        expect(buttons[1].getLabel()).toBe("No");
    });
});
