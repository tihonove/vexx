import type { ILineTokens } from "../ILineTokens.ts";

import type { IState } from "./IState.ts";

export interface ITokenizationResult {
    readonly tokens: ILineTokens;
    readonly endState: IState;
}

/**
 * Synchronous line-by-line tokenizer (TextMate-style).
 *
 * Concrete implementations live both in this package (built-in word tokenizer
 * for demos) and in external packages (full TextMate via vscode-textmate, LSP
 * semantic tokens). The {@link DocumentTokenStore} is the only consumer.
 *
 * Extension point: an asynchronous variant (`tokenizeLineAsync`) will be added
 * once LSP semantic tokens land — the synchronous method stays the contract
 * for fast highlighters.
 */
export interface ITokenizationSupport {
    getInitialState(): IState;
    tokenizeLine(line: string, state: IState): ITokenizationResult;
}
