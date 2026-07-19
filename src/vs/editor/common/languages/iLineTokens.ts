/**
 * A single token within a line.
 *
 * `startIndex` is the character offset where this token begins.
 * `scopes` is a TextMate-style scope stack (most general → most specific),
 * e.g. `["source.ts", "keyword.control.flow.ts"]`. The renderer resolves
 * a style by walking the stack from most specific to most general.
 *
 * The token implicitly ends where the next token starts (or at line length
 * for the last token).
 */
export interface IToken {
    readonly startIndex: number;
    readonly scopes: readonly string[];
}

/**
 * All tokens for a single line, sorted by startIndex ascending.
 * The first token must have startIndex === 0.
 */
export interface ILineTokens {
    readonly tokens: readonly IToken[];
}

export function createToken(startIndex: number, scopes: readonly string[]): IToken {
    return { startIndex, scopes };
}

export function createLineTokens(tokens: readonly IToken[]): ILineTokens {
    return { tokens };
}
