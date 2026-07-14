import type { TUIElement } from "../tuiElement.ts";

import { TUIEventBase } from "./tuiEventBase.ts";

export class TUIFocusEvent extends TUIEventBase {
    public readonly relatedTarget: TUIElement | null;

    public constructor(type: "focus" | "blur", relatedTarget: TUIElement | null = null) {
        super(type, true);
        this.relatedTarget = relatedTarget;
    }
}
