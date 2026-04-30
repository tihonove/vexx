import type { IGrammar, IRawGrammar, Registry } from "vscode-textmate";
import vsctm from "vscode-textmate";

import type { IAssetAccess } from "../../../Common/Assets/IAssetAccess.ts";
import type { ITokenizationSupport } from "../ITokenizationSupport.ts";

import { getOnigLib } from "./OnigLib.ts";
import { TextMateTokenizationSupport } from "./TextMateTokenizationSupport.ts";

/**
 * Описание грамматики в bundle: scope (`source.js`), виртуальный путь к
 * `.tmLanguage.json` (резолвится через {@link IAssetAccess}) и опциональный
 * список injection-scopes, которые нужно подключать в эту грамматику.
 */
export interface IGrammarRecord {
    readonly scopeName: string;
    readonly path: string;
    readonly injections?: readonly string[];
}

/**
 * Фабрика над `vscode-textmate.Registry`. Принимает массив записей
 * (включая injection-грамматики) и предоставляет асинхронную загрузку
 * нашего {@link ITokenizationSupport} по scope-имени.
 *
 * Все грамматики читаются через {@link IAssetAccess} лениво — при первом
 * запросе.
 */
export class TextMateGrammarLoader {
    private readonly assets: IAssetAccess;
    private readonly registry: Registry;
    private readonly recordsByScope = new Map<string, IGrammarRecord>();
    private readonly injectionsByHost = new Map<string, string[]>();
    private readonly grammarCache = new Map<string, Promise<IGrammar | null>>();

    public constructor(assets: IAssetAccess, records: readonly IGrammarRecord[]) {
        this.assets = assets;
        for (const rec of records) {
            this.recordsByScope.set(rec.scopeName, rec);
            if (rec.injections) {
                for (const host of rec.injections) {
                    let list = this.injectionsByHost.get(host);
                    if (list === undefined) {
                        list = [];
                        this.injectionsByHost.set(host, list);
                    }
                    list.push(rec.scopeName);
                }
            }
        }

        this.registry = new vsctm.Registry({
            onigLib: getOnigLib(this.assets),
            loadGrammar: (scopeName) => this.loadRawGrammar(scopeName),
            getInjections: (scopeName) => this.injectionsByHost.get(scopeName),
        });
    }

    public async loadSupport(scopeName: string): Promise<ITokenizationSupport | null> {
        // Если scope не зарегистрирован у нас — отдадим null без обращения к
        // Registry, иначе vscode-textmate бросит «No grammar provided».
        if (!this.recordsByScope.has(scopeName)) return null;
        const grammar = await this.loadGrammar(scopeName);
        if (grammar === null) return null;
        return new TextMateTokenizationSupport(grammar, scopeName);
    }

    public dispose(): void {
        this.registry.dispose();
    }

    private loadGrammar(scopeName: string): Promise<IGrammar | null> {
        let pending = this.grammarCache.get(scopeName);
        if (pending === undefined) {
            pending = this.registry.loadGrammar(scopeName);
            this.grammarCache.set(scopeName, pending);
        }
        return pending;
    }

    private async loadRawGrammar(scopeName: string): Promise<IRawGrammar | null> {
        const rec = this.recordsByScope.get(scopeName);
        if (rec === undefined) return null;
        const content = this.assets.readText(rec.path);
        return vsctm.parseRawGrammar(content, rec.path);
    }
}
