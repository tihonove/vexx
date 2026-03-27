import { TUIEventBase } from "./TUIEventBase.ts";

export interface TUIKeyboardEventInit {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    raw?: string;
}

export class TUIKeyboardEvent extends TUIEventBase {
    public readonly key: string;
    public readonly code: string;
    public readonly ctrlKey: boolean;
    public readonly shiftKey: boolean;
    public readonly altKey: boolean;
    public readonly metaKey: boolean;
    public readonly raw: string;

    public constructor(type: "keypress" | "keydown" | "keyup", init: TUIKeyboardEventInit) {
        super(type, true);
        this.key = init.key;
        this.code = init.code ?? "";
        this.ctrlKey = init.ctrlKey ?? false;
        this.shiftKey = init.shiftKey ?? false;
        this.altKey = init.altKey ?? false;
        this.metaKey = init.metaKey ?? false;
        this.raw = init.raw ?? "";
    }
}
