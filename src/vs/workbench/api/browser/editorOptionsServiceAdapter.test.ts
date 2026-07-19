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
        });
        expect(new EditorOptionsServiceAdapter(groupWithNoActiveEditor()).getActiveEditorMeta()).toEqual({
            uri: null,
            languageId: null,
            isDirty: false,
            encoding: null,
            eol: null,
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
        });
        // No active editor → nulls are forwarded.
        registered!(null);

        expect(received).toEqual([
            { uri: Uri.file("/a/b.ts").toString(), languageId: "typescript", isDirty: false, encoding: "utf8", eol: 1 },
            { uri: null, languageId: null, isDirty: false, encoding: null, eol: null },
        ]);
    });
});
