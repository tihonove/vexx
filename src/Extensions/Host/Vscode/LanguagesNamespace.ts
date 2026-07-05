import type * as vscode from "vscode";

import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl } from "./VscodeTypes.ts";

/** Зарегистрированный провайдер автодополнения (поверхность — WP8). */
export interface ICompletionRegistration {
    readonly selector: vscode.DocumentSelector;
    readonly provider: vscode.CompletionItemProvider;
    readonly triggerCharacters: readonly string[];
}

/**
 * `vscode.languages` на стороне subprocess.
 *
 * В WP3 — только приём и хранение регистраций провайдеров автодополнения;
 * реальный вызов провайдеров (RPC-запрос от completion-UI) появится в WP8.
 * Список регистраций доступен через возвращаемый {@link registrations}.
 */
export function createLanguagesNamespace(_ctx: IVscodeHostContext): {
    languages: typeof vscode.languages;
    registrations: readonly ICompletionRegistration[];
} {
    const registrations: ICompletionRegistration[] = [];

    const languagesNs = {
        registerCompletionItemProvider: (
            selector: vscode.DocumentSelector,
            provider: vscode.CompletionItemProvider,
            ...triggerCharacters: string[]
        ): vscode.Disposable => {
            const registration: ICompletionRegistration = { selector, provider, triggerCharacters };
            registrations.push(registration);
            return new DisposableImpl(() => {
                const idx = registrations.indexOf(registration);
                if (idx >= 0) registrations.splice(idx, 1);
            }) as unknown as vscode.Disposable;
        },
    };

    return {
        languages: languagesNs as unknown as typeof vscode.languages,
        registrations,
    };
}
