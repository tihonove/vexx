/**
 * A single token within a line. startIndex is the character offset where this token begins.
 */
export interface IToken {
    readonly startIndex: number;
    readonly type: string;
}

/**
 * All tokens for a single line, sorted by startIndex ascending.
 */
export interface ILineTokens {
    readonly tokens: readonly IToken[];
}

export function createToken(startIndex: number, type: string): IToken {
    return { startIndex, type };
}

export function createLineTokens(tokens: readonly IToken[]): ILineTokens {
    return { tokens };
}
