import type { TUIElement } from "../Elements/TUIElement.ts";

import { TUIEventBase } from "./TUIEventBase.ts";

export class TUIFocusEvent extends TUIEventBase {
    public readonly relatedTarget: TUIElement | null;

    public constructor(type: "focus" | "blur", relatedTarget: TUIElement | null = null) {
        super(type, true);
        this.relatedTarget = relatedTarget;
    }
}
