// ─── Kitty protocol tokens ───

export interface CsiUToken {
    readonly kind: "csi-u";
    readonly codepoint: number;
    readonly shiftedKey: number | undefined;
    readonly baseLayoutKey: number | undefined;
    readonly key: string;
    readonly code: string;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    /** 0 = not specified, 1 = press, 2 = repeat, 3 = release */
    readonly eventType: number;
    readonly raw: string;
}

export interface PuaToken {
    readonly kind: "pua";
    readonly codepoint: number;
    readonly key: string;
    readonly code: string;
    readonly raw: string;
}

// ─── Standard CSI / SS3 tokens ───

export interface CsiLetterToken {
    readonly kind: "csi-letter";
    readonly finalByte: string;
    readonly key: string;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    /** 0 = not specified (legacy), 1 = press, 2 = repeat, 3 = release */
    readonly eventType: number;
    readonly raw: string;
}

export interface CsiTildeToken {
    readonly kind: "csi-tilde";
    readonly number: number;
    readonly key: string;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    /** 0 = not specified (legacy), 1 = press, 2 = repeat, 3 = release */
    readonly eventType: number;
    readonly raw: string;
}

export interface Ss3Token {
    readonly kind: "ss3";
    readonly finalByte: string;
    readonly key: string;
    readonly raw: string;
}

// ─── Legacy / standard tokens ───

export interface EscCharToken {
    readonly kind: "esc-char";
    readonly char: string;
    readonly charCode: number;
    readonly raw: string;
}

export interface EscControlToken {
    readonly kind: "esc-control";
    readonly letter: string;
    readonly raw: string;
}

export interface EscSpecialToken {
    readonly kind: "esc-special";
    readonly key: "Enter" | "Backspace";
    readonly raw: string;
}

export interface StandaloneEscToken {
    readonly kind: "standalone-esc";
    readonly raw: string;
}

export interface CharToken {
    readonly kind: "char";
    readonly char: string;
    readonly codepoint: number;
    readonly raw: string;
}

export interface SpecialKeyToken {
    readonly kind: "special-key";
    readonly key: "Enter" | "Tab" | "Backspace";
    readonly raw: string;
}

export interface CtrlCharToken {
    readonly kind: "ctrl-char";
    readonly letter: string;
    readonly raw: string;
}

export interface UnknownByteToken {
    readonly kind: "unknown-byte";
    readonly byte: number;
    readonly raw: string;
}

// ─── OSC tokens ───

export interface OscToken {
    readonly kind: "osc";
    /** OSC command number, e.g. 52 for clipboard */
    readonly code: number;
    /** Everything after the first semicolon, up to the terminator */
    readonly data: string;
    readonly raw: string;
}

// ─── Mouse tokens ───

export type MouseButton = "left" | "middle" | "right" | "none";
export type MouseAction = "press" | "release" | "move" | "scroll-up" | "scroll-down" | "scroll-left" | "scroll-right";

export interface MouseToken {
    readonly kind: "mouse";
    readonly button: MouseButton;
    readonly action: MouseAction;
    /** 1-based column */
    readonly x: number;
    /** 1-based row */
    readonly y: number;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly raw: string;
}

export type RawTerminalToken =
    | CsiUToken
    | PuaToken
    | CsiLetterToken
    | CsiTildeToken
    | Ss3Token
    | EscCharToken
    | EscControlToken
    | EscSpecialToken
    | StandaloneEscToken
    | CharToken
    | SpecialKeyToken
    | CtrlCharToken
    | UnknownByteToken
    | MouseToken
    | OscToken;

export type RawKeyToken =
    | CsiUToken
    | PuaToken
    | CsiLetterToken
    | CsiTildeToken
    | Ss3Token
    | EscCharToken
    | EscControlToken
    | EscSpecialToken
    | StandaloneEscToken
    | CharToken
    | SpecialKeyToken
    | CtrlCharToken
    | UnknownByteToken
    | OscToken;
