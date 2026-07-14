import { createLineTokens, createToken } from "../tokens/lineTokens.ts";
import type { IState } from "./state.ts";
import { NULL_STATE } from "./state.ts";
import type { ITokenizationResult, ITokenizationSupport } from "./tokenizationSupport.ts";

export class PlainTextTokenizer implements ITokenizationSupport {
    public getInitialState(): IState {
        return NULL_STATE;
    }

    public tokenizeLine(_line: string, _state: IState): ITokenizationResult {
        return {
            tokens: createLineTokens([createToken(0, ["text.plain"])]),
            endState: NULL_STATE,
        };
    }
}
