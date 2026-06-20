import { describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { BoxElement } from "../TUIDom/Widgets/BoxElement.ts";

import { InspectorCore, type InspectorTarget } from "./InspectorCore.ts";
import { type GetDocumentResult, InspectorMethod, type InspectorSuccessResponse } from "./protocol.ts";

function makeTarget(): InspectorTarget {
    const body = new BodyElement();
    body.setContent(new BoxElement());
    const app = TestApp.create(body, new Size(10, 3)).app;
    return {
        getRoot: () => app.root,
        getFocused: () => app.focusManager?.activeElement ?? null,
    };
}

describe("InspectorCore", () => {
    it("answers TUIDom.getDocument with the serialized tree", () => {
        const core = new InspectorCore(makeTarget());

        const res = core.dispatch({ id: 1, method: InspectorMethod.getDocument });

        expect(res.id).toBe(1);
        const result = (res as InspectorSuccessResponse).result as GetDocumentResult;
        expect(result.root?.type).toBe("BodyElement");
    });

    it("returns an error for an unknown method", () => {
        const core = new InspectorCore(makeTarget());

        const res = core.dispatch({ id: 2, method: "TUIDom.nope" });

        expect(res).toEqual({ id: 2, error: { message: "Unknown method: TUIDom.nope" } });
    });

    it("turns a throwing handler into an error response", () => {
        const core = new InspectorCore(makeTarget());
        core.register("boom", () => {
            throw new Error("kaboom");
        });

        const res = core.dispatch({ id: 3, method: "boom" });

        expect(res).toEqual({ id: 3, error: { message: "kaboom" } });
    });

    it("stringifies a non-Error thrown value", () => {
        const core = new InspectorCore(makeTarget());
        core.register("boomStr", () => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing the non-Error branch
            throw "plain";
        });

        const res = core.dispatch({ id: 4, method: "boomStr" });

        expect(res).toEqual({ id: 4, error: { message: "plain" } });
    });
});
