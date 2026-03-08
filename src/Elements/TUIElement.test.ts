import { describe, it, expect, vi } from "vitest";
import { TUIElement } from "./TUIElement.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";

function makeKeyEvent(
    overrides: Partial<KeyPressEvent> & { type: KeyPressEvent["type"] },
): KeyPressEvent {
    return {
        key: "a",
        code: "KeyA",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        raw: "a",
        ...overrides,
    };
}

describe("TUIElement event system", () => {
    it("calls keypress listeners on keypress event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keypress", handler);

        const event = makeKeyEvent({ type: "keypress" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keydown listeners on keydown event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keydown", handler);

        const event = makeKeyEvent({ type: "keydown" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keyup listeners on keyup event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keyup", handler);

        const event = makeKeyEvent({ type: "keyup" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("does not call keypress listeners on keydown event", () => {
        const element = new TUIElement();
        const keypressHandler = vi.fn();
        element.addEventListener("keypress", keypressHandler);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(keypressHandler).not.toHaveBeenCalled();
    });

    it("does not crash when emitting event with no listeners", () => {
        const element = new TUIElement();
        expect(() => {
            element.emit(makeKeyEvent({ type: "keypress" }));
            element.emit(makeKeyEvent({ type: "keydown" }));
            element.emit(makeKeyEvent({ type: "keyup" }));
        }).not.toThrow();
    });

    it("supports multiple listeners for the same event type", () => {
        const element = new TUIElement();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        element.addEventListener("keydown", handler1);
        element.addEventListener("keydown", handler2);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removes a specific listener with removeEventListener", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keydown", handler);
        element.removeEventListener("keydown", handler);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler).not.toHaveBeenCalled();
    });

    it("removeEventListener does not affect other listeners", () => {
        const element = new TUIElement();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        element.addEventListener("keypress", handler1);
        element.addEventListener("keypress", handler2);

        element.removeEventListener("keypress", handler1);
        element.emit(makeKeyEvent({ type: "keypress" }));

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removeEventListener is no-op for unregistered handler", () => {
        const element = new TUIElement();
        const handler = vi.fn();

        expect(() => {
            element.removeEventListener("keyup", handler);
        }).not.toThrow();
    });
});
