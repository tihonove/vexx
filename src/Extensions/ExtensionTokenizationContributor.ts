import * as path from "node:path";

import type { IDisposable } from "../Common/Disposable.ts";
import type { IGrammarRecord } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TextMateGrammarLoader } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";

import type { IExtension } from "./IExtension.ts";

/**
 * Применяет вклад расширений в подсветку синтаксиса:
 *   - собирает {@link IGrammarRecord}[] из всех `contributes.grammars`,
 *   - создаёт общий {@link TextMateGrammarLoader},
 *   - для каждой грамматики с привязанным `language` загружает support
 *     и регистрирует его в {@link TokenizationRegistry}.
 *
 * Injection-грамматики (без `language`) только добавляются в loader —
 * vscode-textmate сам подмешает их в хост-грамматики через `getInjections`.
 *
 * Возвращает Disposable, который убирает все регистрации (для будущей
 * выгрузки расширений). Внутри хранит созданный loader, чтобы освободить
 * vscode-textmate Registry при dispose.
 */
export class ExtensionTokenizationContributor implements IDisposable {
    private readonly extensions: readonly IExtension[];
    private readonly tokenizationRegistry: TokenizationRegistry;
    private loader: TextMateGrammarLoader | undefined;
    private registrationDisposables: IDisposable[] = [];

    public constructor(extensions: readonly IExtension[], tokenizationRegistry: TokenizationRegistry) {
        this.extensions = extensions;
        this.tokenizationRegistry = tokenizationRegistry;
    }

    /**
     * Загружает все грамматики и регистрирует поддержку в `TokenizationRegistry`.
     * До завершения промиса в реестре остаются ранее зарегистрированные
     * fallback-токенайзеры (если есть).
     */
    public async apply(): Promise<void> {
        const records = this.collectGrammarRecords();
        if (records.length === 0) return;

        const loader = new TextMateGrammarLoader(records);
        this.loader = loader;

        const tasks: Promise<void>[] = [];
        for (const grammar of this.iterAllGrammars()) {
            if (grammar.language === undefined) continue;
            const languageId = grammar.language;
            const scopeName = grammar.scopeName;
            tasks.push(
                (async () => {
                    try {
                        const support = await loader.loadSupport(scopeName);
                        if (support === null) {
                            console.error(`Failed to load grammar "${scopeName}" for language "${languageId}"`);
                            return;
                        }
                        const disposable = this.tokenizationRegistry.register(languageId, support);
                        this.registrationDisposables.push(disposable);
                    } catch (err) {
                        console.error(`Error loading grammar "${scopeName}" (${languageId}):`, err);
                    }
                })(),
            );
        }
        await Promise.all(tasks);
    }

    public dispose(): void {
        for (const d of this.registrationDisposables) d.dispose();
        this.registrationDisposables = [];
        this.loader?.dispose();
        this.loader = undefined;
    }

    private collectGrammarRecords(): IGrammarRecord[] {
        const records: IGrammarRecord[] = [];
        for (const ext of this.extensions) {
            const grammars = ext.manifest.contributes?.grammars;
            if (grammars === undefined) continue;
            for (const grammar of grammars) {
                records.push({
                    scopeName: grammar.scopeName,
                    path: path.resolve(ext.location, grammar.path),
                    injections: grammar.injectTo,
                });
            }
        }
        return records;
    }

    private *iterAllGrammars() {
        for (const ext of this.extensions) {
            const grammars = ext.manifest.contributes?.grammars;
            if (grammars === undefined) continue;
            for (const grammar of grammars) yield grammar;
        }
    }
}
