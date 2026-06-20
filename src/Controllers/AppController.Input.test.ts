import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

/**
 * End-to-end coverage for the text-input editing commands (selection, clipboard, undo/redo)
 * flowing through the real keybinding system into the QuickOpen input. This is the gap the
 * docs/TODO item describes: the actions exist but were only registered in stories, so until
 * now real inputs had no Shift-selection / Ctrl+C-X-V.
 */
function createApp(tmpDir: string): { testApp: TestApp; controller: AppController } {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);
    return { testApp, controller };
}

describe("AppController — input widget editing via keybindings (QuickOpen)", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-input-"));
        fs.writeFileSync(path.join(tmpDir, "alpha.txt"), "Alpha");
        ({ testApp, controller } = createApp(tmpDir));
        await controller.activate();
        await controller.fileIndexReady;
        // Open Quick Open — its query field is a focused InputElement.
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function input(): InputElement {
        // The find widget also mounts an InputElement, so select the focused one (QuickOpen's).
        const el = testApp.focusedElement;
        expect(el).toBeInstanceOf(InputElement);
        return el as InputElement;
    }

    function type(text: string): void {
        for (const ch of text) testApp.sendKey(ch);
    }

    /** Clipboard actions are async (they await IClipboard); let their microtasks settle. */
    async function flush(): Promise<void> {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    }

    it("focuses the InputElement so inputWidgetFocus is active", () => {
        expect(testApp.focusedElement).toBeInstanceOf(InputElement);
    });

    it("types text into the input", () => {
        type("abc");
        expect(input().inputState.value).toBe("abc");
    });

    it("Shift+ArrowLeft selects toward the start", () => {
        type("hi");
        testApp.sendKey("Shift+ArrowLeft");
        expect(input().inputState.hasSelection).toBe(true);
        expect(input().inputState.selectedText).toBe("i");
    });

    it("Ctrl+A selects the whole value", () => {
        type("hello");
        testApp.sendKey("Ctrl+A");
        expect(input().inputState.selectedText).toBe("hello");
    });

    it("Ctrl+C then Ctrl+V copies and pastes through the clipboard", async () => {
        type("abc");
        testApp.sendKey("Ctrl+A"); // select all
        testApp.sendKey("Ctrl+C"); // copy "abc"
        await flush();
        testApp.sendKey("ArrowRight"); // collapse selection to end
        testApp.sendKey("Ctrl+V"); // paste "abc" at the end
        await flush();
        expect(input().inputState.value).toBe("abcabc");
    });

    it("Ctrl+X cuts the selection to the clipboard", async () => {
        type("abc");
        testApp.sendKey("Ctrl+A");
        testApp.sendKey("Ctrl+X");
        await flush();
        expect(input().inputState.value).toBe("");
    });

    it("Ctrl+Z undoes and Ctrl+Y redoes a paste", async () => {
        type("abc");
        testApp.sendKey("Ctrl+A");
        testApp.sendKey("Ctrl+C");
        await flush();
        testApp.sendKey("ArrowRight");
        testApp.sendKey("Ctrl+V"); // "abcabc"
        await flush();
        expect(input().inputState.value).toBe("abcabc");

        testApp.sendKey("Ctrl+Z"); // undo paste
        expect(input().inputState.value).toBe("abc");

        testApp.sendKey("Ctrl+Y"); // redo paste
        expect(input().inputState.value).toBe("abcabc");
    });
});
