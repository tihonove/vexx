import { describe, expect, it } from "vitest";

import { Size } from "../../../base/common/geometry.ts";
import { TestApp } from "../../../../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../../../base/tui/events/tuiMouseEvent.ts";
import { BodyElement } from "../../../base/tui/bodyElement.ts";

import { QuickInputController } from "./quickInputController.ts";

function createController(): { controller: QuickInputController; body: BodyElement; testApp: TestApp } {
    const controller = new QuickInputController();
    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);
    return { controller, body, testApp };
}

function outsideClick(body: BodyElement): void {
    body.dispatchEvent(
        new TUIMouseEvent("mousedown", { screenX: 0, screenY: 0, localX: 0, localY: 0, button: "left" }),
    );
}

describe("QuickInputController.input", () => {
    it("opens a visible overlay", () => {
        const { controller, body } = createController();
        void controller.input({ title: "Save As" });
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("resolves with the seeded value on Enter", async () => {
        const { controller, testApp } = createController();
        const result = controller.input({ value: "hello.txt" });
        testApp.sendKey("Enter");
        await expect(result).resolves.toBe("hello.txt");
    });

    it("resolves with the typed value on Enter", async () => {
        const { controller, testApp } = createController();
        const result = controller.input({});
        testApp.sendKey("a");
        testApp.sendKey("b");
        testApp.sendKey("Enter");
        await expect(result).resolves.toBe("ab");
    });

    it("resolves undefined on Escape", async () => {
        const { controller, testApp } = createController();
        const result = controller.input({});
        testApp.sendKey("Escape");
        await expect(result).resolves.toBeUndefined();
    });

    it("resolves undefined on an outside click", async () => {
        const { controller, body } = createController();
        const result = controller.input({});
        outsideClick(body);
        await expect(result).resolves.toBeUndefined();
    });

    it("blocks Enter while validation fails, then accepts once valid", async () => {
        const { controller, body, testApp } = createController();
        const result = controller.input({
            value: "",
            validateInput: (v) => (v.trim() === "" ? "Please enter a file name" : null),
        });

        // Seeded value is empty → invalid → Enter is a no-op, overlay stays open.
        testApp.sendKey("Enter");
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);

        testApp.sendKey("x");
        testApp.sendKey("Enter");
        await expect(result).resolves.toBe("x");
    });

    it("supersedes a previous open prompt (resolves it undefined)", async () => {
        const { controller, testApp } = createController();
        const first = controller.input({ value: "one" });
        const second = controller.input({ value: "two" });

        await expect(first).resolves.toBeUndefined();

        testApp.sendKey("Enter");
        await expect(second).resolves.toBe("two");
    });

    it("input() without a host view is a no-op for positioning", () => {
        // No setHostView() → hostBody is null and there is no overlay session.
        const controller = new QuickInputController();
        // input() reaches updatePosition, which early-returns without throwing.
        expect(() => void controller.input({ value: "x" })).not.toThrow();
        // preferredWidth keeps its default since positioning was skipped.
        expect(controller.view.preferredWidth).toBe(60);
    });
});
