import { createLineTokens, createToken } from "../iLineTokens.ts";
import type { IState } from "../iState.ts";
import { NULL_STATE } from "../iState.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../iTokenizationSupport.ts";

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
