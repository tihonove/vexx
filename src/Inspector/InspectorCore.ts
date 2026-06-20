import type { TUIElement } from "../TUIDom/TUIElement.ts";

import { type GetDocumentResult, InspectorMethod, type InspectorRequest, type InspectorResponse } from "./protocol.ts";
import { serializeTree } from "./serializeTree.ts";

/**
 * Read-only view of the inspected application. Decouples the core from
 * `TuiApplication` so the same core can be driven by a WS server, an in-process
 * inspector widget, or a test.
 */
export interface InspectorTarget {
    getRoot(): TUIElement | null;
    getFocused(): TUIElement | null;
}

type MethodHandler = (params: unknown) => unknown;

/**
 * Transport-agnostic inspector. Holds a read-only reference to the inspected
 * app via `InspectorTarget` and answers protocol methods. Methods are a
 * registry, so new ones extend the inspector without touching `dispatch`.
 */
export class InspectorCore {
    private readonly target: InspectorTarget;
    private readonly methods = new Map<string, MethodHandler>();

    public constructor(target: InspectorTarget) {
        this.target = target;
        this.register(InspectorMethod.getDocument, () => this.getDocument());
    }

    public register(method: string, handler: MethodHandler): void {
        this.methods.set(method, handler);
    }

    public dispatch(request: InspectorRequest): InspectorResponse {
        const handler = this.methods.get(request.method);
        if (handler === undefined) {
            return { id: request.id, error: { message: `Unknown method: ${request.method}` } };
        }
        try {
            return { id: request.id, result: handler(request.params) };
        } catch (err) {
            return { id: request.id, error: { message: err instanceof Error ? err.message : String(err) } };
        }
    }

    private getDocument(): GetDocumentResult {
        return { root: serializeTree(this.target.getRoot(), this.target.getFocused()) };
    }
}
