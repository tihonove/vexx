import { describe, expect, it, vi } from "vitest";

import type { RpcEndpoint } from "../../services/extensions/common/rpcProtocol.ts";
import { buildVscodeNamespace } from "./extHost.api.impl.ts";

/**
 * Регресс на баг идентичности: раньше `makeEditorProxy` создавал НОВЫЙ объект
 * editor/document на каждый геттер `activeTextEditor`, и `activeTextEditor.
 * document === doc` (сравнение по ссылке, как в editorconfig) ломалось.
 */
interface StubRpc {
    rpc: RpcEndpoint;
    fireActiveEditorChanged: (fileName: string | null) => void;
    request: ReturnType<typeof vi.fn>;
}

function makeStubRpc(): StubRpc {
    let activeEditorHandler: ((params: unknown) => void) | undefined;
    const request = vi.fn().mockResolvedValue(undefined);
    const rpc = {
        handleNotification: (method: string, handler: (params: unknown) => void) => {
            if (method === "editor.activeEditorChanged") activeEditorHandler = handler;
            return { dispose: () => undefined };
        },
        handleRequest: () => ({ dispose: () => undefined }),
        request,
        notify: vi.fn(),
        dispose: vi.fn(),
    } as unknown as RpcEndpoint;
    return {
        rpc,
        request,
        fireActiveEditorChanged: (fileName) => {
            if (activeEditorHandler === undefined) throw new Error("handler not registered");
            activeEditorHandler({ fileName });
        },
    };
}

describe("VscodeNamespace — стабильная идентичность activeTextEditor", () => {
    it("повторный activeTextEditor возвращает ту же ссылку", () => {
        const { rpc, fireActiveEditorChanged } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        fireActiveEditorChanged("/f.ts");
        expect(vscode.window.activeTextEditor).toBe(vscode.window.activeTextEditor);
    });

    it("editor.document стабилен по ссылке (=== doc для editorconfig)", () => {
        const { rpc, fireActiveEditorChanged } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        fireActiveEditorChanged("/f.ts");
        const doc1 = vscode.window.activeTextEditor?.document;
        const doc2 = vscode.window.activeTextEditor?.document;
        expect(doc1).toBe(doc2);
        expect(doc1?.fileName).toBe("/f.ts");
    });

    it("editor из onDidChangeActiveTextEditor === window.activeTextEditor", () => {
        const { rpc, fireActiveEditorChanged } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        let delivered: unknown;
        vscode.window.onDidChangeActiveTextEditor((e) => (delivered = e));
        fireActiveEditorChanged("/f.ts");
        expect(delivered).toBe(vscode.window.activeTextEditor);
    });

    it("document — полноценный ExtHostTextDocument (uri/lineAt)", () => {
        const { rpc, fireActiveEditorChanged } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        fireActiveEditorChanged("/dir/f.ts");
        const doc = vscode.window.activeTextEditor?.document as unknown as {
            uri: { fsPath: string };
            lineAt: (n: number) => { text: string };
        };
        expect(doc.uri.fsPath).toBe("/dir/f.ts");
        expect(doc.lineAt(0).text).toBe("");
    });

    it("установка options проксируется в rpc.request(editor.setOptions)", () => {
        const { rpc, fireActiveEditorChanged, request } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        fireActiveEditorChanged("/f.ts");
        const editor = vscode.window.activeTextEditor!;
        editor.options = { tabSize: 2, insertSpaces: true };
        expect(request).toHaveBeenCalledWith("editor.setOptions", { tabSize: 2, insertSpaces: true });
    });

    it("fileName=null → activeTextEditor undefined", () => {
        const { rpc, fireActiveEditorChanged } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace;
        fireActiveEditorChanged("/f.ts");
        expect(vscode.window.activeTextEditor).toBeDefined();
        fireActiveEditorChanged(null);
        expect(vscode.window.activeTextEditor).toBeUndefined();
    });

    it("value-типы экспортированы как runtime-поля", () => {
        const { rpc } = makeStubRpc();
        const vscode = buildVscodeNamespace(rpc).namespace as unknown as Record<string, unknown>;
        for (const name of ["Position", "Range", "TextEdit", "Uri", "EventEmitter", "EndOfLine"]) {
            expect(vscode[name], name).toBeDefined();
        }
    });
});
