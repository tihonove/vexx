import { describe, expect, it } from "vitest";

import { DocumentRegistry } from "./ExtHostDocuments.ts";
import { makeStubRpc } from "./testStubRpc.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { createWindowNamespace } from "./WindowNamespace.ts";
import { WorkspaceConfigStore } from "./WorkspaceConfigStore.ts";

function makeCtx() {
    const stub = makeStubRpc();
    const ctx: IVscodeHostContext = {
        rpc: stub.rpc,
        registry: new DocumentRegistry(),
        configStore: new WorkspaceConfigStore(),
    };
    return { stub, ctx, window: createWindowNamespace(ctx) };
}

describe("WindowNamespace", () => {
    it("activeEditorChanged с meta прокидывает languageId/isDirty в документ", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", {
            fileName: "/a.ts",
            languageId: "typescript",
            isDirty: true,
        });
        const doc = window.activeTextEditor?.document as unknown as {
            languageId: string;
            isDirty: boolean;
            fileName: string;
        };
        expect(doc.fileName).toBe("/a.ts");
        expect(doc.languageId).toBe("typescript");
        expect(doc.isDirty).toBe(true);
    });

    it("editor.document стабилен по ссылке между обращениями", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts", languageId: "typescript" });
        expect(window.activeTextEditor?.document).toBe(window.activeTextEditor?.document);
    });

    it("fileName=null → activeTextEditor undefined", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        expect(window.activeTextEditor).toBeDefined();
        stub.fire("editor.activeEditorChanged", { fileName: null });
        expect(window.activeTextEditor).toBeUndefined();
    });

    it("установка options проксируется в editor.setOptions", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        window.activeTextEditor!.options = { tabSize: 2, insertSpaces: true };
        expect(stub.requests).toContainEqual({
            method: "editor.setOptions",
            params: { tabSize: 2, insertSpaces: true },
        });
    });

    it("indentSize форвардится в editor.setOptions", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        window.activeTextEditor!.options = { indentSize: 3 } as never;
        expect(stub.requests).toContainEqual({
            method: "editor.setOptions",
            params: { indentSize: 3 },
        });
    });

    it('indentSize="tabSize" не форвардится (совпадает с tabSize)', () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        window.activeTextEditor!.options = { indentSize: "tabSize" } as never;
        expect(stub.requests).toHaveLength(0);
    });

    it("show*Message шлёт window.showMessage с правильным severity", async () => {
        const { stub, window } = makeCtx();
        await window.showErrorMessage("boom");
        await window.showWarningMessage("careful");
        await window.showInformationMessage("fyi");
        expect(stub.notifies).toEqual([
            { method: "window.showMessage", params: { severity: "error", message: "boom" } },
            { method: "window.showMessage", params: { severity: "warn", message: "careful" } },
            { method: "window.showMessage", params: { severity: "info", message: "fyi" } },
        ]);
    });

    it("window.state сфокусировано; onDidChangeWindowState регистрируется и не стреляет", () => {
        const { window } = makeCtx();
        expect(window.state).toEqual({ focused: true, active: true });
        let fired = false;
        const d = window.onDidChangeWindowState(() => (fired = true));
        expect(typeof d.dispose).toBe("function");
        expect(fired).toBe(false);
    });

    it("createOutputChannel возвращает no-op канал", () => {
        const { window } = makeCtx();
        const ch = window.createOutputChannel("editorconfig");
        expect(ch.name).toBe("editorconfig");
        expect(() => {
            ch.appendLine("x");
            ch.dispose();
        }).not.toThrow();
    });
});
