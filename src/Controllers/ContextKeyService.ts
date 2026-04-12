import { token } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

import type { ContextKey, ContextKeyTypes } from "./ContextKeys.ts";
import { allContextKeys } from "./ContextKeys.ts";

export const ContextKeyServiceDIToken = token<ContextKeyService>("ContextKeyService");

type ContextValue = boolean | string | number;

export class ContextKeyService implements IDisposable {
    private values = new Map<ContextKey, ContextValue>();

    public set<K extends ContextKey>(key: K, value: ContextKeyTypes[K]): void {
        this.values.set(key, value);
    }

    public get<K extends ContextKey>(key: K): ContextKeyTypes[K] | undefined {
        return this.values.get(key) as ContextKeyTypes[K] | undefined;
    }

    public reset(key: ContextKey): void {
        this.values.delete(key);
    }

    /**
     * Evaluates a when-expression string using the current context values.
     * Supports standard JS operators: &&, ||, !, ==, !=, >, <, >=, <=
     * Boolean keys are false by default, string/number keys are undefined.
     *
     * Example: evaluate("textInputFocus && !listFocus")
     * Example: evaluate("editorLangId == 'typescript'")
     */
    public evaluate(when: string): boolean {
        const args = allContextKeys.map((k) => this.values.get(k) ?? false);
        try {
            const fn = new Function(...allContextKeys, `return !!(${when})`);
            return fn(...args) as boolean;
        } catch {
            return false;
        }
    }

    public dispose(): void {
        this.values.clear();
    }
}
