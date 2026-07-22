import { describe, expect, it, vi } from "vitest";

import { Uri } from "../../../base/common/uri.ts";
import type { EditorService } from "../../services/editor/browser/editorService.ts";

import { EditorOptionsServiceAdapter } from "./editorOptionsServiceAdapter.ts";

/**
 * Минимальный стаб EditorService — адаптер использует только
 * `getActiveEditor()` (и в других методах — больше). Здесь нам нужен случай
 * «нет активного редактора».
 */
function groupWithNoActiveEditor(): EditorService {
    return {
        getActiveEditor: () => null,
    } as unknown as EditorService;
}

describe("EditorOptionsServiceAdapter", () => {
    it("getActiveEditorOptions() returns null when there is no active editor (line 20)", () => {
        const adapter = new EditorOptionsServiceAdapter(groupWithNoActiveEditor());
        expect(adapter.getActiveEditorOptions()).toBeNull();
    });

    it("getActiveEditorOptions() reads tabSize/insertSpaces from the active editor", () => {
        const group = {
            getActiveEditor: () => ({
                viewState: { tabSize: 4, insertSpaces: true },
            }),
        } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);
        expect(adapter.getActiveEditorOptions()).toEqual({ tabSize: 4, insertSpaces: true });
    });

    it("setActiveEditorOptions() is a no-op when there is no active editor", () => {
        const adapter = new EditorOptionsServiceAdapter(groupWithNoActiveEditor());
        expect(() => {
            adapter.setActiveEditorOptions({ tabSize: 2 });
        }).not.toThrow();
    });

    it("setActiveEditorOptions() forwards the patch to the active editor", () => {
        const setIndentOptions = vi.fn();
        const group = {
            getActiveEditor: () => ({ setIndentOptions }),
        } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);
        adapter.setActiveEditorOptions({ tabSize: 8 });
        expect(setIndentOptions).toHaveBeenCalledWith({ tabSize: 8 });
    });

    it("getActiveEditorFilePath() returns null when there is no active editor", () => {
        const adapter = new EditorOptionsServiceAdapter(groupWithNoActiveEditor());
        expect(adapter.getActiveEditorFilePath()).toBeNull();
    });

    it("getActiveEditorFilePath() отдаёт путь для file:-ресурса", () => {
        const group = {
            getActiveEditor: () => ({ uri: Uri.file("/a/b.ts"), languageId: "typescript", isModified: false }),
        } as unknown as EditorService;
        expect(new EditorOptionsServiceAdapter(group).getActiveEditorFilePath()).toBe("/a/b.ts");
    });

    it("getActiveEditorFilePath() отдаёт null для безымянного буфера, а не мусорный путь", () => {
        // fsPath у untitled: вернул бы относительный "Untitled-1" — потребителю
        // (editorconfig) такой «путь» скармливать нельзя.
        const group = {
            getActiveEditor: () => ({
                uri: Uri.parse("untitled:Untitled-1"),
                languageId: "plaintext",
                isModified: false,
            }),
        } as unknown as EditorService;
        expect(new EditorOptionsServiceAdapter(group).getActiveEditorFilePath()).toBeNull();
    });

    it("getActiveEditorMeta() reports uri/languageId/isDirty (nulls when no editor)", () => {
        const withEditor = {
            getActiveEditor: () => ({
                uri: Uri.file("/a/b.ts"),
                languageId: "typescript",
                isModified: true,
                encoding: "windows1251",
                eol: 2,
            }),
        } as unknown as EditorService;
        expect(new EditorOptionsServiceAdapter(withEditor).getActiveEditorMeta()).toEqual({
            uri: Uri.file("/a/b.ts").toString(),
            languageId: "typescript",
            isDirty: true,
            encoding: "windows1251",
            eol: 2,
            selection: null,
        });
        expect(new EditorOptionsServiceAdapter(groupWithNoActiveEditor()).getActiveEditorMeta()).toEqual({
            uri: null,
            languageId: null,
            isDirty: false,
            encoding: null,
            eol: null,
            selection: null,
        });
    });

    it("onActiveEditorChanged() forwards active-editor meta, and nulls when there is no editor", () => {
        let registered: ((editor: unknown) => void) | undefined;
        const groupDisposable = { dispose: vi.fn() };
        const group = {
            onActiveEditorChanged: (cb: (editor: unknown) => void) => {
                registered = cb;
                return groupDisposable;
            },
        } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);

        const received: unknown[] = [];
        const subscription = adapter.onActiveEditorChanged((meta) => received.push(meta));

        // The adapter passes the group's disposable straight through.
        expect(subscription).toBe(groupDisposable);
        expect(registered).toBeDefined();

        // Active editor present → its meta is forwarded.
        registered!({
            uri: Uri.file("/a/b.ts"),
            languageId: "typescript",
            isModified: false,
            encoding: "utf8",
            eol: 1,
            viewState: {
                selections: [{ anchor: { line: 0, character: 2 }, active: { line: 1, character: 4 } }],
            },
        });
        // No active editor → nulls are forwarded.
        registered!(null);

        expect(received).toEqual([
            {
                uri: Uri.file("/a/b.ts").toString(),
                languageId: "typescript",
                isDirty: false,
                encoding: "utf8",
                eol: 1,
                selection: { anchorLine: 0, anchorCharacter: 2, activeLine: 1, activeCharacter: 4 },
            },
            { uri: null, languageId: null, isDirty: false, encoding: null, eol: null, selection: null },
        ]);
    });

    it("setActiveEditorSelections() — no-op при несовпадении uri", () => {
        const setSelections = vi.fn();
        const group = {
            getActiveEditor: () => ({
                uri: Uri.file("/a/b.ts"),
                get viewState() {
                    return {
                        get selections() {
                            return [];
                        },
                        set selections(v: unknown) {
                            setSelections(v);
                        },
                    };
                },
                focusEditor: vi.fn(),
            }),
        } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);
        adapter.setActiveEditorSelections(Uri.file("/other.ts").toString(), [
            { anchorLine: 0, anchorCharacter: 0, activeLine: 0, activeCharacter: 1 },
        ]);
        expect(setSelections).not.toHaveBeenCalled();
    });

    it("applyActiveEditorEdits() — false при несовпадении uri, true при применении", () => {
        const applyExternalEdits = vi.fn();
        const editor = {
            uri: Uri.file("/a/b.ts"),
            model: { document: { lineCount: 3, getLineLength: () => 10 } },
            applyExternalEdits,
        };
        const group = { getActiveEditor: () => editor } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);

        const edit = { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 }, text: "hi" };
        expect(adapter.applyActiveEditorEdits(Uri.file("/other.ts").toString(), [edit])).toBe(false);
        expect(applyExternalEdits).not.toHaveBeenCalled();

        expect(adapter.applyActiveEditorEdits(Uri.file("/a/b.ts").toString(), [edit])).toBe(true);
        expect(applyExternalEdits).toHaveBeenCalledOnce();
    });

    it("applyActiveEditorEdits() — false, если нет активного редактора или пустой список", () => {
        const editor = {
            uri: Uri.file("/a/b.ts"),
            model: { document: { lineCount: 3, getLineLength: () => 10 } },
            applyExternalEdits: vi.fn(),
        };
        const group = { getActiveEditor: () => editor } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);
        expect(adapter.applyActiveEditorEdits(Uri.file("/a/b.ts").toString(), [])).toBe(false);
        expect(new EditorOptionsServiceAdapter(groupWithNoActiveEditor()).setActiveEditorSelections("x", [])).toBeUndefined();
    });

    it("клампит выделения и правки к границам документа", () => {
        let setSel: unknown;
        const applyExternalEdits = vi.fn();
        const editor = {
            uri: Uri.file("/a/b.ts"),
            model: { document: { lineCount: 3, getLineLength: () => 10 } },
            get viewState() {
                return {
                    get selections() {
                        return [];
                    },
                    set selections(v: unknown) {
                        setSel = v;
                    },
                };
            },
            focusEditor: vi.fn(),
            applyExternalEdits,
        };
        const group = { getActiveEditor: () => editor } as unknown as EditorService;
        const adapter = new EditorOptionsServiceAdapter(group);
        const uri = Uri.file("/a/b.ts").toString();

        // anchor вне границ снизу/слева, active вне границ сверху/справа.
        adapter.setActiveEditorSelections(uri, [
            { anchorLine: -5, anchorCharacter: -3, activeLine: 99, activeCharacter: 999 },
        ]);
        expect(setSel).toEqual([
            { anchor: { line: 0, character: 0 }, active: { line: 2, character: 10 }, idealColumn: undefined },
        ]);

        adapter.applyActiveEditorEdits(uri, [
            { range: { startLine: -1, startCharacter: -1, endLine: 50, endCharacter: 50 }, text: "z" },
        ]);
        const applied = applyExternalEdits.mock.calls[0][0];
        expect(applied).toEqual([
            { range: { start: { line: 0, character: 0 }, end: { line: 2, character: 10 } }, text: "z" },
        ]);
    });

    it("getActiveEditorMeta() — selection null, когда выделений нет", () => {
        const group = {
            getActiveEditor: () => ({
                uri: Uri.file("/a/b.ts"),
                languageId: "typescript",
                isModified: false,
                encoding: "utf8",
                eol: 1,
                viewState: { selections: [] },
            }),
        } as unknown as EditorService;
        expect(new EditorOptionsServiceAdapter(group).getActiveEditorMeta().selection).toBeNull();
    });
});
