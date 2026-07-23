import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../backend/mockTerminalBackend.ts";
import { Size } from "../common/geometryPromitives.ts";
import { BodyElement } from "../ui/body/bodyElement.ts";

import { TuiApplication } from "./tuiApplication.ts";

function nextImmediate(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

describe("TuiApplication scheduleRender", () => {
    it("re-renders after async markDirty via setImmediate", async () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        body.title = "Hi";
        app.root = body;
        app.run();

        expect(backend.screenToString()).toContain("Hi");

        // Simulate async state change (e.g. timer callback)
        body.title = "Bye";
        body.markDirty();

        // Synchronously, screen still shows old content
        expect(backend.screenToString()).toContain("Hi");

        // After setImmediate fires, screen should update
        await nextImmediate();

        expect(backend.screenToString()).toContain("Bye");
    });

    it("batches multiple markDirty calls into a single render", async () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run();

        const renderSpy = vi.spyOn(backend, "renderFrame");
        renderSpy.mockClear();

        // Multiple markDirty calls in the same microtask
        body.markDirty();
        body.markDirty();
        body.markDirty();

        await nextImmediate();

        // Only one render should have happened
        expect(renderSpy.mock.calls.length).toBe(1);
    });

    it("does not schedule render when no callback is set (detached element)", async () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run();

        const renderSpy = vi.spyOn(backend, "renderFrame");
        renderSpy.mockClear();

        // Create a detached element (no root, no callback)
        const detached = new BodyElement();
        detached.markDirty();

        await nextImmediate();

        // No extra render triggered from detached element
        expect(renderSpy.mock.calls.length).toBe(0);
    });

    it("exposes frameCount and isRenderScheduled for the inspector's idle wait", async () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run(); // initial render

        expect(app.frameCount).toBeGreaterThanOrEqual(1);
        expect(app.isRenderScheduled).toBe(false);

        const afterRun = app.frameCount;

        // markDirty schedules a deferred render — observable as isRenderScheduled.
        body.markDirty();
        expect(app.isRenderScheduled).toBe(true);

        await nextImmediate();

        // The scheduled render ran: counter advanced, flag cleared.
        expect(app.frameCount).toBe(afterRun + 1);
        expect(app.isRenderScheduled).toBe(false);
    });

    it("synchronous render from handleInput skips scheduled async render", async () => {
        const backend = new MockTerminalBackend(new Size(10, 3));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        app.root = body;
        app.run();

        const renderSpy = vi.spyOn(backend, "renderFrame");
        renderSpy.mockClear();

        // markDirty schedules a setImmediate render
        body.markDirty();

        // User input triggers synchronous render(s) — one per key event
        backend.sendKey("a");

        const countAfterInput = renderSpy.mock.calls.length;
        expect(countAfterInput).toBeGreaterThanOrEqual(1);

        // setImmediate fires but layout is clean — no extra render
        await nextImmediate();

        expect(renderSpy.mock.calls.length).toBe(countAfterInput);
    });
});
