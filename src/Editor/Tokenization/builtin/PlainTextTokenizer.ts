import { createLineTokens, createToken } from "../../ILineTokens.ts";
import type { IState } from "../IState.ts";
import { NULL_STATE } from "../IState.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../ITokenizationSupport.ts";

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
