/**
 * Tokenizer state at the boundary between two lines.
 *
 * For stateless tokenizers (plain text, simple word splitter) a single shared
 * sentinel value is enough. For TextMate the state is the rule stack and must
 * be cloned before mutation; equality lets the cache stop re-tokenizing once
 * subsequent lines would yield the same end state.
 */
export interface IState {
    clone(): IState;
    equals(other: IState): boolean;
}

/** Stateless tokenizer state — singleton, immutable. */
export const NULL_STATE: IState = {
    clone(): IState {
        return NULL_STATE;
    },
    equals(other: IState): boolean {
        return other === NULL_STATE;
    },
};
