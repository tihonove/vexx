import type { StateStack } from "vscode-textmate";

import type { IState } from "../IState.ts";

/**
 * Обёртка `vscode-textmate.StateStack` под наш {@link IState}.
 *
 * `StateStack` иммутабельный: `clone()` фактически возвращает self, `equals()`
 * нативный (сравнение фреймов по reference equality + контент). Мы используем
 * это, чтобы `DocumentTokenStore` мог обрывать перетокенизацию хвоста, когда
 * end-state стабилизировался.
 */
export class TextMateState implements IState {
    public readonly stack: StateStack;

    public constructor(stack: StateStack) {
        this.stack = stack;
    }

    public clone(): IState {
        // StateStack иммутабелен: его собственный clone() возвращает self.
        // Никаких аллокаций.
        return new TextMateState(this.stack.clone());
    }

    public equals(other: IState): boolean {
        if (!(other instanceof TextMateState)) return false;
        return this.stack.equals(other.stack);
    }
}
