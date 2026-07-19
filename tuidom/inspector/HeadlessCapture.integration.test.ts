import { describe, expect, it } from "vitest";

import { HeadlessCaptureBackend } from "../backend/headlessCaptureBackend.ts";
import { Size } from "../common/geometryPromitives.ts";
import { TuiApplication } from "../dom/tuiApplication.ts";
import type { GridSnapshot } from "../rendering/gridSnapshot.ts";
import { BodyElement } from "../ui/body/bodyElement.ts";
import { InputElement } from "../ui/inputbox/inputElement.ts";

import { InspectorCore, type InspectorTarget } from "./InspectorCore.ts";
import type { InspectorDriver } from "./InspectorDriver.ts";
import { type CaptureFrameResult, InspectorMethod, type InspectorSuccessResponse } from "./protocol.ts";

/**
 * End-to-end proof of the `--headless` hack without a terminal: a *real*
 * `TuiApplication` runs on `HeadlessCaptureBackend`, and an `InspectorCore` with
 * a driver injects keys and reads the rendered screen back — exactly the path the
 * WebSocket inspector uses in headless mode.
 */

function renderToLines(frame: GridSnapshot): string[] {
    const lines: string[] = [];
    for (let y = 0; y < frame.rows; y++) {
        let line = "";
        for (let x = 0; x < frame.cols; x++) line += frame.cells[y * frame.cols + x].char;
        lines.push(line);
    }
    return lines;
}

function setup() {
    const backend = new HeadlessCaptureBackend(new Size(40, 3));
    const app = new TuiApplication(backend);
    const input = new InputElement();
    const body = new BodyElement();
    body.setContent(input);
    app.root = body;
    app.run();
    input.focus();

    const target: InspectorTarget = {
        getRoot: () => app.root,
        getFocused: () => app.focusManager?.activeElement ?? null,
    };
    const driver: InspectorDriver = {
        sendKey: (name) => {
            backend.sendKey(name);
        },
        sendText: (text) => {
            backend.sendPaste(text);
        },
        resize: (cols, rows) => {
            backend.resize(new Size(cols, rows));
        },
        captureFrame: async () => {
            await new Promise<void>((resolve) => setImmediate(resolve));
            return backend.captureFrame();
        },
        shutdown: () => undefined,
    };
    const core = new InspectorCore(target, driver);
    return { core, input };
}

async function capture(core: InspectorCore): Promise<GridSnapshot> {
    const res = await core.dispatch({ id: 99, method: InspectorMethod.captureFrame });
    return ((res as InspectorSuccessResponse).result as CaptureFrameResult).frame;
}

describe("headless capture (real app, no terminal)", () => {
    it("renders typed keys into the captured frame", async () => {
        const { core } = setup();

        for (const ch of "hi") {
            await core.dispatch({ id: 1, method: InspectorMethod.sendKey, params: { name: ch } });
        }
        const frame = await capture(core);

        expect(renderToLines(frame).join("\n")).toContain("hi");
    });

    it("renders pasted text into the captured frame", async () => {
        const { core } = setup();

        await core.dispatch({ id: 1, method: InspectorMethod.sendText, params: { text: "world" } });
        const frame = await capture(core);

        expect(renderToLines(frame).join("\n")).toContain("world");
    });

    it("captureFrame reports the driven terminal size", async () => {
        const { core } = setup();

        const frame = await capture(core);

        expect(frame.cols).toBe(40);
        expect(frame.rows).toBe(3);
    });
});
