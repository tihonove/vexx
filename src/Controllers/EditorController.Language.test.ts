import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IDocumentLanguageChange } from "../Editor/IDocumentLanguageChange.ts";
import { createLineTokens, createToken } from "../Editor/ILineTokens.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../Editor/Tokenization/ITokenizationSupport.ts";
import { NULL_STATE } from "../Editor/Tokenization/IState.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

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
    let tmpDir: string;
    let registry: TokenizationRegistry;
    let ctrl: EditorController;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-editorctrl-lang-"));
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
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
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
