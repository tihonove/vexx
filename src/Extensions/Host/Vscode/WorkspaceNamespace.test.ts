import { describe, expect, it } from "vitest";

import { DocumentRegistry } from "./ExtHostDocuments.ts";
import { makeStubRpc } from "./testStubRpc.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { Uri } from "./VscodeTypes.ts";
import { WorkspaceConfigStore } from "./WorkspaceConfigStore.ts";
import { createWorkspaceNamespace } from "./WorkspaceNamespace.ts";

function makeCtx() {
    const stub = makeStubRpc();
    const ctx: IVscodeHostContext = {
        rpc: stub.rpc,
        registry: new DocumentRegistry(),
        configStore: new WorkspaceConfigStore(),
    };
    return { stub, ctx, workspace: createWorkspaceNamespace(ctx) };
}

describe("WorkspaceNamespace — configuration", () => {
    it("getConfiguration читает из pushed workspace.initialize", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", {
            configuration: { editor: { tabSize: 2 }, editorconfig: { generateAuto: true } },
            workspaceFolders: [],
        });
        expect(workspace.getConfiguration("editor").get("tabSize")).toBe(2);
        expect(workspace.getConfiguration("editorconfig").get("generateAuto")).toBe(true);
        expect(workspace.getConfiguration().get("editor.tabSize")).toBe(2);
    });

    it("get с defaultValue для отсутствующего ключа", () => {
        const { workspace } = makeCtx();
        expect(workspace.getConfiguration("editor").get("tabSize", 4)).toBe(4);
        expect(workspace.getConfiguration("editor").has("tabSize")).toBe(false);
    });

    it("значения секции доступны как поля объекта конфигурации", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", {
            configuration: { editor: { tabSize: 2, insertSpaces: false } },
            workspaceFolders: [],
        });
        const config = workspace.getConfiguration("editor") as unknown as {
            tabSize: number;
            insertSpaces: boolean;
        };
        expect(config.tabSize).toBe(2);
        expect(config.insertSpaces).toBe(false);
    });

    it("inspect разделяет default/global слои", () => {
        const { ctx, stub, workspace } = makeCtx();
        ctx.configStore.applyDefaults({ "editor.tabSize": 4 });
        stub.fire("workspace.initialize", { configuration: { editor: { tabSize: 8 } }, workspaceFolders: [] });
        const inspected = workspace.getConfiguration("editor").inspect("tabSize");
        expect(inspected?.defaultValue).toBe(4);
        expect(inspected?.globalValue).toBe(8);
    });

    it("update не поддержан — резолвится и шлёт warn", async () => {
        const { stub, workspace } = makeCtx();
        await workspace.getConfiguration("editor").update("tabSize", 2);
        expect(stub.notifies[0]?.method).toBe("window.showMessage");
        expect((stub.notifies[0]?.params as { severity: string }).severity).toBe("warn");
    });

    it("значение секции с именем как у метода (get/has) не затирает метод", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", {
            configuration: { section: { get: 1, value: 2 } },
            workspaceFolders: [],
        });
        const config = workspace.getConfiguration("section");
        // `get` остаётся функцией, `value` — зеркалится как поле
        expect(typeof config.get).toBe("function");
        expect((config as unknown as { value: number }).value).toBe(2);
    });

    it("configurationChanged без affectedKeys не падает", () => {
        const { stub, workspace } = makeCtx();
        let seen: boolean | undefined;
        workspace.onDidChangeConfiguration((e: { affectsConfiguration(s: string): boolean }) => {
            seen = e.affectsConfiguration("editor");
        });
        stub.fire("workspace.configurationChanged", { configuration: {} });
        expect(seen).toBe(false);
    });

    it("configurationChanged переустанавливает снапшот и стреляет событие", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", { configuration: { editor: { tabSize: 2 } }, workspaceFolders: [] });
        let affectsEditor: boolean | undefined;
        workspace.onDidChangeConfiguration((e: { affectsConfiguration(section: string): boolean }) => {
            affectsEditor = e.affectsConfiguration("editor");
        });
        stub.fire("workspace.configurationChanged", {
            configuration: { editor: { tabSize: 8 } },
            affectedKeys: ["editor.tabSize"],
        });
        expect(workspace.getConfiguration("editor").get("tabSize")).toBe(8);
        expect(affectsEditor).toBe(true);
    });
});

describe("WorkspaceNamespace — folders & documents", () => {
    it("workspaceFolders приходит из initialize", () => {
        const { stub, workspace } = makeCtx();
        expect(workspace.workspaceFolders).toBeUndefined();
        stub.fire("workspace.initialize", {
            configuration: {},
            workspaceFolders: [{ uri: "/repo", name: "repo", index: 0 }],
        });
        expect(workspace.workspaceFolders).toHaveLength(1);
        expect(workspace.workspaceFolders![0].name).toBe("repo");
    });

    it("initialize без workspaceFolders → folders пусты", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", { configuration: {} });
        expect(workspace.workspaceFolders).toBeUndefined();
        expect(workspace.name).toBeUndefined();
    });

    it("asRelativePath относительно папки воркспейса", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", {
            configuration: {},
            workspaceFolders: [{ uri: "/repo", name: "repo", index: 0 }],
        });
        expect(workspace.asRelativePath("/repo/src/a.ts")).toBe("src/a.ts");
        // Uri вместо строки
        expect(workspace.asRelativePath(Uri.file("/repo/src/a.ts") as never)).toBe("src/a.ts");
        // сам корень → возвращается как есть
        expect(workspace.asRelativePath("/repo")).toBe("/repo");
        // вне папки — возвращается как есть
        expect(workspace.asRelativePath("/other/b.ts")).toBe("/other/b.ts");
    });

    it("asRelativePath с includeWorkspaceFolder в multi-root добавляет имя папки", () => {
        const { stub, workspace } = makeCtx();
        stub.fire("workspace.initialize", {
            configuration: {},
            workspaceFolders: [
                { uri: "/a", name: "a", index: 0 },
                { uri: "/b", name: "b", index: 1 },
            ],
        });
        expect(workspace.asRelativePath("/b/x.ts", true)).toBe("b/x.ts");
    });

    it("textDocuments отражает реестр", () => {
        const { ctx, workspace } = makeCtx();
        ctx.registry.getOrCreate("/a.ts");
        ctx.registry.getOrCreate("/b.ts");
        expect(workspace.textDocuments).toHaveLength(2);
    });

    it("openTextDocument резолвит открытый документ (строка и Uri), иначе reject", async () => {
        const { ctx, workspace } = makeCtx();
        ctx.registry.getOrCreate("/a.ts");
        const byString = await workspace.openTextDocument("/a.ts");
        expect((byString as unknown as { fileName: string }).fileName).toBe("/a.ts");
        const byUri = await workspace.openTextDocument(Uri.file("/a.ts") as never);
        expect((byUri as unknown as { fileName: string }).fileName).toBe("/a.ts");
        await expect(workspace.openTextDocument("/missing.ts")).rejects.toThrow();
    });
});

describe("WorkspaceNamespace — save subscriptions", () => {
    it("первый onWillSaveTextDocument шлёт updateSubscriptions {willSave:true}", () => {
        const { stub, workspace } = makeCtx();
        const d1 = workspace.onWillSaveTextDocument(() => undefined);
        expect(stub.notifies).toContainEqual({
            method: "workspace.updateSubscriptions",
            params: { willSave: true, didSave: false },
        });
        // второй слушатель не шлёт повторно
        const before = stub.notifies.length;
        const d2 = workspace.onWillSaveTextDocument(() => undefined);
        expect(stub.notifies.length).toBe(before);
        // dispose обоих → willSave:false
        d1.dispose();
        d2.dispose();
        expect(stub.notifies.at(-1)).toEqual({
            method: "workspace.updateSubscriptions",
            params: { willSave: false, didSave: false },
        });
    });

    it("onWillSaveTextDocument кладёт disposable в переданный массив", () => {
        const { workspace } = makeCtx();
        const bag: { dispose(): unknown }[] = [];
        const d = workspace.onWillSaveTextDocument(() => undefined, undefined, bag as never);
        expect(bag).toContain(d);
    });

    it("onDidSaveTextDocument: флаг, второй слушатель, dispose до нуля, disposables", () => {
        const { stub, workspace } = makeCtx();
        const bag: { dispose(): unknown }[] = [];
        const d1 = workspace.onDidSaveTextDocument(() => undefined, undefined, bag as never);
        expect(bag).toContain(d1);
        expect(stub.notifies).toContainEqual({
            method: "workspace.updateSubscriptions",
            params: { willSave: false, didSave: true },
        });
        // второй слушатель не шлёт повторно
        const before = stub.notifies.length;
        const d2 = workspace.onDidSaveTextDocument(() => undefined);
        expect(stub.notifies.length).toBe(before);
        d1.dispose();
        d2.dispose();
        expect(stub.notifies.at(-1)).toEqual({
            method: "workspace.updateSubscriptions",
            params: { willSave: false, didSave: false },
        });
    });
});
