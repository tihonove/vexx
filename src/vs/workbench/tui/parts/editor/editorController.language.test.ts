import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IDocumentLanguageChange } from "../../../../editor/common/model/documentLanguageChange.ts";
import { createLineTokens, createToken } from "../../../../editor/common/tokens/lineTokens.ts";
import type { ILanguageService } from "../../../../editor/common/languages/language.ts";
import { NULL_STATE } from "../../../../editor/common/languages/state.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../../../../editor/common/languages/tokenizationSupport.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";

import { EditorController } from "./editorController.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

/** Токенизатор-маркер: помечает всю строку одним заданным scope. */
function markerTokenizer(scope: string): ITokenizationSupport {
    return {
        getInitialState: () => NULL_STATE,
        tokenizeLine(): ITokenizationResult {
            return { tokens: createLineTokens([createToken(0, [scope])]), endState: NULL_STATE };
        },
    };
}

const TS_ONLY_LANGUAGE_SERVICE: ILanguageService = {
    getLanguageIdForResource: (filePath) => (filePath.endsWith(".ts") ? "typescript" : undefined),
    getLanguageDisplayName: () => undefined,
};

function firstScope(ctrl: EditorController): string | undefined {
    const tokenStore = ctrl.viewState.tokenStore;
    tokenStore?.tokenizeUpTo(0);
    return tokenStore?.getLineTokens(0)?.tokens[0]?.scopes[0];
}

describe("EditorController — language", () => {
    let ws: ITempWorkspace;
    let registry: TokenizationRegistry;
    let ctrl: EditorController;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-editorctrl-lang-" });
        registry = new TokenizationRegistry();
        ctrl = new EditorController(
            new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
            registry,
            NULL_TOKEN_STYLE_RESOLVER,
            TS_ONLY_LANGUAGE_SERVICE,
            new UndoRedoService(),
        );
    });

    afterEach(() => {
        ctrl.dispose();
        ws.dispose();
    });

    function writeFile(name: string, content: string): string {
        return ws.writeFile(name, content);
    }

    it("до открытия файла язык plaintext", () => {
        expect(ctrl.languageId).toBe("plaintext");
    });

    it("openFile резолвит язык через ILanguageService", () => {
        ctrl.openFile(writeFile("a.ts", "const x = 1;"));
        expect(ctrl.languageId).toBe("typescript");
    });

    it("незнакомое расширение откатывается на plaintext", () => {
        ctrl.openFile(writeFile("a.unknown", "?"));
        expect(ctrl.languageId).toBe("plaintext");
    });

    it("setLanguage меняет язык и ретранслирует событие подписчикам контроллера", () => {
        const changes: IDocumentLanguageChange[] = [];
        // Подписка ДО openFile — должна пережить пересоздание документа.
        ctrl.onDidChangeLanguage((change) => changes.push(change));

        ctrl.openFile(writeFile("a.ts", "const x = 1;"));
        ctrl.setLanguage("markdown");

        expect(ctrl.languageId).toBe("markdown");
        expect(changes).toEqual([{ oldLanguageId: "typescript", newLanguageId: "markdown" }]);
    });

    it("dispose подписки onDidChangeLanguage останавливает доставку, повторный dispose — no-op", () => {
        let fired = 0;
        const subscription = ctrl.onDidChangeLanguage(() => fired++);
        ctrl.openFile(writeFile("a.ts", "const x = 1;"));

        ctrl.setLanguage("markdown");
        subscription.dispose();
        subscription.dispose();
        ctrl.setLanguage("json");

        expect(fired).toBe(1);
    });

    it("setLanguage пересаживает токенизатор на язык назначения", () => {
        registry.register("markdown", markerTokenizer("markup.markdown"));
        ctrl.openFile(writeFile("a.ts", "# header"));
        expect(firstScope(ctrl)).not.toBe("markup.markdown");

        ctrl.setLanguage("markdown");

        expect(firstScope(ctrl)).toBe("markup.markdown");
    });

    it("hot-swap: грамматика, зарегистрированная после openFile, подхватывается", () => {
        ctrl.openFile(writeFile("a.ts", "const x = 1;"));
        // Файл открыт до регистрации — работает fallback PlainTextTokenizer.
        expect(firstScope(ctrl)).not.toBe("source.ts");

        registry.register("typescript", markerTokenizer("source.ts"));

        expect(firstScope(ctrl)).toBe("source.ts");
    });

    it("регистрация грамматики чужого языка не инвалидирует токены", () => {
        registry.register("typescript", markerTokenizer("source.ts"));
        ctrl.openFile(writeFile("a.ts", "const x = 1;"));
        expect(firstScope(ctrl)).toBe("source.ts");

        registry.register("python", markerTokenizer("source.python"));

        expect(firstScope(ctrl)).toBe("source.ts");
    });
});
