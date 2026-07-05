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
        const bag: { dispose(): unknown }[] = [];
        const d = window.onDidChangeWindowState(() => (fired = true), undefined, bag as never);
        expect(bag).toContain(d);
        expect(typeof d.dispose).toBe("function");
        d.dispose();
        // без disposables-массива тоже работает
        const d2 = window.onDidChangeWindowState(() => undefined);
        expect(typeof d2.dispose).toBe("function");
        expect(fired).toBe(false);
    });

    it("onDidChangeActiveTextEditor: thisArgs привязывается, disposables и dispose работают", () => {
        const { stub, window } = makeCtx();
        const received: [unknown, unknown][] = [];
        const self = { tag: "self" };
        const bag: { dispose(): unknown }[] = [];
        const d = window.onDidChangeActiveTextEditor(
            function (this: { tag: string }, e) {
                received.push([this?.tag, e]);
            },
            self,
            bag as never,
        );
        expect(bag).toContain(d);
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        expect(received[0][0]).toBe("self");
        // после dispose слушатель отписан
        d.dispose();
        stub.fire("editor.activeEditorChanged", { fileName: "/b.ts" });
        expect(received).toHaveLength(1);
        // повторный dispose безопасен (idx < 0)
        expect(() => d.dispose()).not.toThrow();
    });

    it("options принимает строковые tabSize/insertSpaces/indentSize", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        window.activeTextEditor!.options = { tabSize: "6", insertSpaces: "false" } as never;
        expect(stub.requests.at(-1)).toEqual({ method: "editor.setOptions", params: { tabSize: 6, insertSpaces: false } });
        window.activeTextEditor!.options = { insertSpaces: "auto" } as never;
        expect(stub.requests.at(-1)).toEqual({ method: "editor.setOptions", params: { insertSpaces: true } });
        window.activeTextEditor!.options = { indentSize: "3" } as never;
        expect(stub.requests.at(-1)).toEqual({ method: "editor.setOptions", params: { indentSize: 3 } });
    });

    it("options с мусорными строками деградирует безопасно", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        // tabSize невалидна → 4; indentSize невалидна → не форвардится
        window.activeTextEditor!.options = { tabSize: "bad", indentSize: "bad" } as never;
        expect(stub.requests.at(-1)).toEqual({ method: "editor.setOptions", params: { tabSize: 4 } });
    });

    it("присвоение options не-объекта и других свойств отклоняется", () => {
        const { stub, window } = makeCtx();
        stub.fire("editor.activeEditorChanged", { fileName: "/a.ts" });
        const editor = window.activeTextEditor!;
        // options = не-объект → set-trap возвращает false (TypeError в strict mode)
        expect(() => {
            (editor as unknown as { options: unknown }).options = null;
        }).toThrow();
        // любое другое свойство editor — только для чтения
        expect(() => {
            (editor as unknown as { document: unknown }).document = {};
        }).toThrow();
        expect(stub.requests).toHaveLength(0);
    });

    it("createOutputChannel возвращает no-op канал (все методы)", () => {
        const { window } = makeCtx();
        const ch = window.createOutputChannel("editorconfig");
        expect(ch.name).toBe("editorconfig");
        expect(() => {
            ch.append("a");
            ch.appendLine("b");
            ch.replace("c");
            ch.clear();
            ch.show();
            ch.hide();
            ch.dispose();
        }).not.toThrow();
    });
});
