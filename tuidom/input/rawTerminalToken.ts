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

/**
 * A *complete* but unrecognized CSI sequence (ESC `[` … final byte in 0x40–0x7e that
 * matched no key/mouse/device-report handler). Carries the full raw bytes so the whole
 * sequence is consumed and dropped rather than leaking its `[…u`-style bytes into the
 * buffer as literal characters. Distinct from a `null` parse, which means *incomplete*
 * (a sequence cut across stdin reads, which must be buffered until the rest arrives).
 */
export interface UnknownCsiToken {
    readonly kind: "unknown-csi";
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

// ─── Device-report tokens ───

/**
 * A private-mode CSI response to one of our capability probes — NOT a key event.
 *  - "kitty-flags": reply to the Kitty keyboard-protocol query `CSI ? u` → `CSI ? <flags> u`.
 *  - "da1":         reply to Primary Device Attributes `CSI c` → `CSI ? <attrs> c`.
 * These begin with the private marker `?`, which never appears in a real key event.
 */
export interface DeviceReportToken {
    readonly kind: "device-report";
    readonly report: "kitty-flags" | "da1";
    /** Raw parameter bytes including the leading `?` (e.g. "?15" or "?62;1;6"). */
    readonly params: string;
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
    | UnknownCsiToken
    | MouseToken
    | OscToken
    | DeviceReportToken;

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
    | UnknownByteToken;
