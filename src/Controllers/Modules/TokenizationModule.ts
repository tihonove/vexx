import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { ILanguageService } from "../../Editor/Tokenization/ILanguageService.ts";
import type { ITokenStyleResolver } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "../CoreTokens.ts";

export interface TokenizationModuleContext {
    tokenizationRegistry: TokenizationRegistry;
    tokenStyleResolver: ITokenStyleResolver;
    languageService: ILanguageService;
}

/**
 * Подсветка синтаксиса: реестр грамматик, резолвер стилей и language service.
 * Все три реализации передаются снаружи — в production это нагруженный
 * `TokenizationRegistry` + `TokenThemeResolver`, в тестах — пустые/NULL-стабы.
 */
export const tokenizationModule: ContainerModule<TokenizationModuleContext> = (
    container,
    { tokenizationRegistry, tokenStyleResolver, languageService },
) => {
    container.bind(TokenizationRegistryDIToken, () => tokenizationRegistry);
    container.bind(TokenStyleResolverDIToken, () => tokenStyleResolver);
    container.bind(LanguageServiceDIToken, () => languageService);
};
