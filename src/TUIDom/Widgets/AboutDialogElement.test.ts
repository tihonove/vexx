import { describe, expect, it, vi } from "vitest";

import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { VEXX_VERSION } from "../../Common/Version.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";

import { AboutDialogElement } from "./AboutDialogElement.tsx";
import type { ButtonElement } from "./ButtonElement.ts";

function mount() {
    const dialog = new AboutDialogElement();
    const testApp = TestApp.createWithContent(dialog, new Size(80, 24));
    const okButton = testApp.querySelector("ButtonElement") as ButtonElement;
    return { dialog, testApp, okButton };
}

describe("AboutDialogElement", () => {
    it("renders the app name, version, Node version and repo url", () => {
        const { testApp } = mount();
        testApp.render();
        const text = testApp.backend.screenToString();
        expect(text).toContain("Vexx");
        expect(text).toContain(`Version ${VEXX_VERSION}`);
        expect(text).toContain(`Node ${process.version}`);
        expect(text).toContain("github.com/tihonove/vexx");
    });

    it("focusDefault focuses the OK button", () => {
        const { dialog, testApp, okButton } = mount();
        dialog.focusDefault();
        expect(testApp.focusedElement).toBe(okButton);
        expect(okButton.getLabel()).toBe("OK");
    });

    it("Escape triggers onClose", () => {
        const { dialog, testApp } = mount();
        const onClose = vi.fn();
        dialog.onClose = onClose;
        dialog.focusDefault();

        dialog.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it("ignores other keys", () => {
        const { dialog } = mount();
        const onClose = vi.fn();
        dialog.onClose = onClose;

        dialog.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));

        expect(onClose).not.toHaveBeenCalled();
    });

    it("activating the OK button triggers onClose", () => {
        const { dialog, testApp, okButton } = mount();
        const onClose = vi.fn();
        dialog.onClose = onClose;
        okButton.focus();

        testApp.focusedElement?.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));

        expect(onClose).toHaveBeenCalledOnce();
    });
});
