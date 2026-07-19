import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { TestApp } from "../../src/TestUtils/TestApp.ts";
import { BodyElement } from "../../src/vs/base/browser/ui/body/bodyElement.ts";
import { BoxElement } from "../../src/vs/base/browser/ui/layout/boxElement.ts";
import { Size } from "../common/geometryPromitives.ts";

import { type AttachedInspector, attachInspector } from "./attachInspector.ts";
import type { GetDocumentResult, InspectorResponse, InspectorSuccessResponse } from "./protocol.ts";

describe("InspectorServer smoke (real WebSocket)", () => {
    let attached: AttachedInspector | undefined;

    afterEach(() => {
        attached?.dispose();
        attached = undefined;
    });

    it("answers TUIDom.getDocument over a real ws round-trip", async () => {
        const body = new BodyElement();
        body.setContent(new BoxElement());
        const app = TestApp.create(body, new Size(20, 5)).app;
        attached = await attachInspector(app, { host: "127.0.0.1", port: 0 });

        const ws = new WebSocket(`ws://127.0.0.1:${attached.port}`);
        const response = await new Promise<InspectorResponse>((resolve, reject) => {
            ws.on("open", () => {
                ws.send(JSON.stringify({ id: 1, method: "TUIDom.getDocument" }));
            });
            ws.on("message", (data: WebSocket.RawData) => {
                resolve(JSON.parse((data as Buffer).toString("utf8")) as InspectorResponse);
            });
            ws.on("error", reject);
        });
        ws.close();

        expect(response.id).toBe(1);
        const result = (response as InspectorSuccessResponse).result as GetDocumentResult;
        expect(result.root?.type).toBe("BodyElement");
    });
});
