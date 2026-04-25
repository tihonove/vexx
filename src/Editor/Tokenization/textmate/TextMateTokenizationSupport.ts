import type { IGrammar } from "vscode-textmate";
import vsctm from "vscode-textmate";

import type { IToken } from "../../ILineTokens.ts";
import { createLineTokens, createToken } from "../../ILineTokens.ts";
import type { IState } from "../IState.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../ITokenizationSupport.ts";

import { TextMateState } from "./TextMateState.ts";

/**
 * Защита от ReDoS в oniguruma — экстремально длинные строки токенизируются
 * как один сырой токен в root-scope. VS Code использует похожую эвристику
 * (`MAX_TOKENIZATION_LINE_LENGTH = 20000`).
 */
const MAX_LINE_LENGTH = 20_000;

/**
 * Адаптер `vscode-textmate.IGrammar` под наш {@link ITokenizationSupport}.
 *
 * На каждый вызов `tokenizeLine` отдаём `IGrammar.tokenizeLine` (текстовый
 * API со scope-стеками). Бинарный `tokenizeLine2` оставлен на отдельную
 * оптимизацию — там нужно перенастроить рендер на разбор metadata.
 */
export class TextMateTokenizationSupport implements ITokenizationSupport {
    private readonly grammar: IGrammar;
    private readonly rootScope: string;

    public constructor(grammar: IGrammar, rootScope: string) {
        this.grammar = grammar;
        this.rootScope = rootScope;
    }

    public getInitialState(): IState {
        return new TextMateState(vsctm.INITIAL);
    }

    public tokenizeLine(line: string, state: IState): ITokenizationResult {
        if (!(state instanceof TextMateState)) {
            throw new Error("TextMateTokenizationSupport: incompatible IState");
        }

        if (line.length > MAX_LINE_LENGTH) {
            return {
                tokens: createLineTokens([createToken(0, [this.rootScope])]),
                endState: state,
            };
        }

        const result = this.grammar.tokenizeLine(line, state.stack);
        const tokens: IToken[] = result.tokens.map((t) => createToken(t.startIndex, t.scopes));
        return {
            tokens: createLineTokens(tokens),
            endState: new TextMateState(result.ruleStack),
        };
    }
}
