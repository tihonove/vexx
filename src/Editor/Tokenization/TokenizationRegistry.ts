import type { IDisposable } from "../../Common/Disposable.ts";

import type { ITokenizationSupport } from "./ITokenizationSupport.ts";

/**
 * Registry that maps a `languageId` to its {@link ITokenizationSupport}.
 *
 * Mirrors `monaco.languages.TokenizationRegistry`. Language detection (which
 * languageId belongs to which file) is intentionally out of scope — that
 * concern lives in higher layers (controllers / language services).
 */
export class TokenizationRegistry {
    private supports = new Map<string, ITokenizationSupport>();
    private listeners: ((languageId: string) => void)[] = [];

    public register(languageId: string, support: ITokenizationSupport): IDisposable {
        this.supports.set(languageId, support);
        this.fireChange(languageId);
        return {
            dispose: () => {
                if (this.supports.get(languageId) === support) {
                    this.supports.delete(languageId);
                    this.fireChange(languageId);
                }
            },
        };
    }

    public get(languageId: string): ITokenizationSupport | undefined {
        return this.supports.get(languageId);
    }

    public onDidChange(listener: (languageId: string) => void): IDisposable {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const i = this.listeners.indexOf(listener);
                if (i >= 0) this.listeners.splice(i, 1);
            },
        };
    }

    private fireChange(languageId: string): void {
        for (const listener of this.listeners) listener(languageId);
    }
}
