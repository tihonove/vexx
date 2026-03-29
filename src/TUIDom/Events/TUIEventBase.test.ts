import { describe, expect, it } from "vitest";

import { EventPhase, TUIEventBase } from "./TUIEventBase.ts";

describe("TUIEventBase", () => {
    it("stores type and bubbles", () => {
        const event = new TUIEventBase("keydown", true);
        expect(event.type).toBe("keydown");
        expect(event.bubbles).toBe(true);
    });

    it("defaults bubbles to true", () => {
        const event = new TUIEventBase("test");
        expect(event.bubbles).toBe(true);
    });

    it("initializes with NONE phase and null targets", () => {
        const event = new TUIEventBase("test");
        expect(event.eventPhase).toBe(EventPhase.NONE);
        expect(event.target).toBeNull();
        expect(event.currentTarget).toBeNull();
    });

    it("stopPropagation sets propagationStopped", () => {
        const event = new TUIEventBase("test");
        expect(event.propagationStopped).toBe(false);
        event.stopPropagation();
        expect(event.propagationStopped).toBe(true);
    });

    it("stopImmediatePropagation also sets propagationStopped", () => {
        const event = new TUIEventBase("test");
        expect(event.immediatePropagationStopped).toBe(false);
        expect(event.propagationStopped).toBe(false);
        event.stopImmediatePropagation();
        expect(event.immediatePropagationStopped).toBe(true);
        expect(event.propagationStopped).toBe(true);
    });

    it("preventDefault sets defaultPrevented", () => {
        const event = new TUIEventBase("test");
        expect(event.defaultPrevented).toBe(false);
        event.preventDefault();
        expect(event.defaultPrevented).toBe(true);
    });

    it("supports non-bubbling events", () => {
        const event = new TUIEventBase("focus", false);
        expect(event.bubbles).toBe(false);
    });
});
