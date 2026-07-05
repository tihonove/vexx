import { describe, expect, it } from "vitest";

import type { WireCompletionItem } from "../WireTypes.ts";

import { DocumentRegistry } from "./ExtHostDocuments.ts";
import { createLanguagesNamespace } from "./LanguagesNamespace.ts";
import { makeStubRpc, type IStubRpc } from "./testStubRpc.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { CompletionItem, CompletionItemKind, Range } from "./VscodeTypes.ts";
import { WorkspaceConfigStore } from "./WorkspaceConfigStore.ts";

function makeCtx(stub: IStubRpc = makeStubRpc()): { ctx: IVscodeHostContext; stub: IStubRpc } {
    const ctx: IVscodeHostContext = {
        rpc: stub.rpc,
        registry: new DocumentRegistry(),
        configStore: new WorkspaceConfigStore(),
    };
    return { ctx, stub };
}

const COMPLETION_PARAMS = {
    fileName: "/proj/.editorconfig",
    languageId: "editorconfig",
    text: "ind",
    line: 0,
    character: 3,
};

describe("LanguagesNamespace", () => {
    it("registerCompletionItemProvider сохраняет регистрацию и возвращает Disposable", () => {
        const { ctx } = makeCtx();
        const { languages, registrations } = createLanguagesNamespace(ctx);
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

    it("сигналит languages.updateSubscriptions на переходах 0↔1", () => {
        const { ctx, stub } = makeCtx();
        const { languages } = createLanguagesNamespace(ctx);
        const provider = { provideCompletionItems: () => [] } as never;
        const d1 = languages.registerCompletionItemProvider({ language: "editorconfig" }, provider);
        const d2 = languages.registerCompletionItemProvider({ language: "ini" }, provider);
        const subs = stub.notifies.filter((n) => n.method === "languages.updateSubscriptions");
        // Только переход 0→1 шлёт notif (второй провайдер не шлёт).
        expect(subs).toHaveLength(1);
        expect(subs[0].params).toEqual({ hasCompletionProviders: true });

        d1.dispose(); // ещё остаётся d2 — notif нет
        expect(stub.notifies.filter((n) => n.method === "languages.updateSubscriptions")).toHaveLength(1);
        d2.dispose(); // 1→0 — notif {false}
        const after = stub.notifies.filter((n) => n.method === "languages.updateSubscriptions");
        expect(after).toHaveLength(2);
        expect(after[1].params).toEqual({ hasCompletionProviders: false });
    });

    it("provideCompletionItems вызывает только матчащие провайдеры и сериализует items", async () => {
        const { ctx, stub } = makeCtx();
        const { languages } = createLanguagesNamespace(ctx);

        const matching = new CompletionItem("indent_style", CompletionItemKind.Property);
        matching.detail = "EditorConfig";
        matching.command = { command: "editorconfig._triggerSuggestAfterDelay", title: "..." };
        const otherLangItem = new CompletionItem("should_not_appear");

        languages.registerCompletionItemProvider(
            { language: "editorconfig", pattern: "**/.editorconfig" },
            { provideCompletionItems: () => [matching] } as never,
        );
        languages.registerCompletionItemProvider(
            { language: "ini" },
            { provideCompletionItems: () => [otherLangItem] } as never,
        );

        const result = (await stub.callRequest(
            "languages.provideCompletionItems",
            COMPLETION_PARAMS,
        )) as WireCompletionItem[];

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("indent_style");
        expect(result[0].insertText).toBe("indent_style"); // fallback на label
        expect(result[0].kind).toBe(CompletionItemKind.Property);
        expect(result[0].detail).toBe("EditorConfig");
        expect(result[0].command?.command).toBe("editorconfig._triggerSuggestAfterDelay");
    });

    it("provideCompletionItems: CompletionList и Range, сбойный провайдер не роняет остальные", async () => {
        const { ctx, stub } = makeCtx();
        const { languages } = createLanguagesNamespace(ctx);

        const withRange = new CompletionItem("root");
        withRange.insertText = "root = true";
        withRange.range = new Range(0, 0, 0, 3);

        languages.registerCompletionItemProvider(
            { language: "editorconfig" },
            {
                provideCompletionItems: () => {
                    throw new Error("boom");
                },
            } as never,
        );
        languages.registerCompletionItemProvider(
            { language: "editorconfig" },
            { provideCompletionItems: () => ({ items: [withRange] }) } as never,
        );

        const result = (await stub.callRequest(
            "languages.provideCompletionItems",
            COMPLETION_PARAMS,
        )) as WireCompletionItem[];

        expect(result).toHaveLength(1);
        expect(result[0].insertText).toBe("root = true");
        expect(result[0].range).toEqual({ startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 3 });
    });

    it("provideCompletionItems без матчащих провайдеров → пустой массив", async () => {
        const { ctx, stub } = makeCtx();
        const { languages } = createLanguagesNamespace(ctx);
        languages.registerCompletionItemProvider(
            { language: "python" },
            { provideCompletionItems: () => [new CompletionItem("x")] } as never,
        );
        const result = await stub.callRequest("languages.provideCompletionItems", COMPLETION_PARAMS);
        expect(result).toEqual([]);
    });
});
