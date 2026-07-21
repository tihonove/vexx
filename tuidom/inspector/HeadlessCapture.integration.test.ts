import { describe, expect, it } from "vitest";

import { HeadlessCaptureBackend } from "../backend/headlessCaptureBackend.ts";
import { Size } from "../common/geometryPromitives.ts";
import { TuiApplication } from "../dom/tuiApplication.ts";
import type { TUIElement } from "../dom/tuiElement.ts";
import type { GridSnapshot } from "../rendering/gridSnapshot.ts";
import { BodyElement } from "../ui/body/bodyElement.ts";
import { ButtonElement } from "../ui/button/buttonElement.ts";
import { InputElement } from "../ui/inputbox/inputElement.ts";

import { InspectorCore, type InspectorTarget } from "./InspectorCore.ts";
import type { InspectorDriver } from "./InspectorDriver.ts";
import {
    type CaptureFrameResult,
    type GetDocumentResult,
    InspectorMethod,
    type InspectorSuccessResponse,
} from "./protocol.ts";

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

function setup(content: TUIElement = new InputElement()) {
    const backend = new HeadlessCaptureBackend(new Size(40, 3));
    const app = new TuiApplication(backend);
    const body = new BodyElement();
    body.setContent(content);
    app.root = body;
    app.run();
    content.focus();

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
        sendMouse: (params) => {
            backend.sendMouse({ ...params, x: params.x + 1, y: params.y + 1 });
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
    return { core, content };
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

    it("clicks the element found in the document by its box", async () => {
        const button = new ButtonElement("OK");
        const clicks: string[] = [];
        button.onActivate = () => clicks.push("activated");
        const { core } = setup(button);

        // The whole point of 0-based protocol coordinates: read the node's box
        // from getDocument and aim at it directly, no arithmetic in the client.
        const doc = await core.dispatch({ id: 1, method: InspectorMethod.getDocument });
        const box = ((doc as InspectorSuccessResponse).result as GetDocumentResult).root?.children[0]?.box;
        expect(box).toBeDefined();
        const at = { x: box!.x, y: box!.y };

        await core.dispatch({
            id: 2,
            method: InspectorMethod.sendMouse,
            params: { action: "press", button: "left", ...at },
        });
        await core.dispatch({
            id: 3,
            method: InspectorMethod.sendMouse,
            params: { action: "release", button: "left", ...at },
        });

        expect(clicks).toEqual(["activated"]);
    });

    it("delivers a wheel event with its direction and modifiers", async () => {
        const button = new ButtonElement("OK");
        const wheels: { direction: string | undefined; ctrl: boolean }[] = [];
        button.addEventListener("wheel", (event) => {
            wheels.push({ direction: event.wheelDirection, ctrl: event.ctrlKey });
        });
        const { core } = setup(button);

        await core.dispatch({
            id: 1,
            method: InspectorMethod.sendMouse,
            params: { action: "scroll-down", x: 0, y: 0, ctrlKey: true },
        });

        expect(wheels).toEqual([{ direction: "down", ctrl: true }]);
    });

    it("captureFrame reports the driven terminal size", async () => {
        const { core } = setup();

        const frame = await capture(core);

        expect(frame.cols).toBe(40);
        expect(frame.rows).toBe(3);
    });
});
