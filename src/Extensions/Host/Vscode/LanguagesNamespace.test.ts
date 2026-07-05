import { describe, expect, it } from "vitest";

import { DocumentRegistry } from "./ExtHostDocuments.ts";
import { createLanguagesNamespace } from "./LanguagesNamespace.ts";
import { makeStubRpc } from "./testStubRpc.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { WorkspaceConfigStore } from "./WorkspaceConfigStore.ts";

function makeCtx(): IVscodeHostContext {
    return {
        rpc: makeStubRpc().rpc,
        registry: new DocumentRegistry(),
        configStore: new WorkspaceConfigStore(),
    };
}

describe("LanguagesNamespace", () => {
    it("registerCompletionItemProvider сохраняет регистрацию и возвращает Disposable", () => {
        const { languages, registrations } = createLanguagesNamespace(makeCtx());
        const provider = { provideCompletionItems: () => [] } as never;
        const disposable = languages.registerCompletionItemProvider(
            { language: "editorconfig", pattern: "**/.editorconfig" },
            provider,
            "=",
            ".",
        );
        expect(registrations).toHaveLength(1);
        expect(registrations[0].provider).toBe(provider);
        expect(registrations[0].triggerCharacters).toEqual(["=", "."]);
        disposable.dispose();
        expect(registrations).toHaveLength(0);
        // повторный dispose безопасен (ветка idx < 0)
        expect(() => disposable.dispose()).not.toThrow();
        expect(registrations).toHaveLength(0);
    });
});
