import { describe, expect, it, vi } from "vitest";

import type { EditorGroupController } from "../../tui/parts/editor/editorGroupController.ts";

import { EditorOptionsServiceAdapter } from "./mainThreadEditorOptions.ts";

/**
 * Минимальный стаб EditorGroupController — адаптер использует только
 * `getActiveEditor()` (и в других методах — больше). Здесь нам нужен случай
 * «нет активного редактора».
 */
function groupWithNoActiveEditor(): EditorGroupController {
    return {
        getActiveEditor: () => null,
    } as unknown as EditorGroupController;
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
        } as unknown as EditorGroupController;
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
        } as unknown as EditorGroupController;
        const adapter = new EditorOptionsServiceAdapter(group);
        adapter.setActiveEditorOptions({ tabSize: 8 });
        expect(setIndentOptions).toHaveBeenCalledWith({ tabSize: 8 });
    });

    it("getActiveEditorFilePath() returns null when there is no active editor", () => {
        const adapter = new EditorOptionsServiceAdapter(groupWithNoActiveEditor());
        expect(adapter.getActiveEditorFilePath()).toBeNull();
    });

    it("getActiveEditorMeta() reports fileName/languageId/isDirty (nulls when no editor)", () => {
        const withEditor = {
            getActiveEditor: () => ({
                absoluteFilePath: "/a/b.ts",
                languageId: "typescript",
                isModified: true,
            }),
        } as unknown as EditorGroupController;
        expect(new EditorOptionsServiceAdapter(withEditor).getActiveEditorMeta()).toEqual({
            fileName: "/a/b.ts",
            languageId: "typescript",
            isDirty: true,
        });
        expect(new EditorOptionsServiceAdapter(groupWithNoActiveEditor()).getActiveEditorMeta()).toEqual({
            fileName: null,
            languageId: null,
            isDirty: false,
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
        } as unknown as EditorGroupController;
        const adapter = new EditorOptionsServiceAdapter(group);

        const received: unknown[] = [];
        const subscription = adapter.onActiveEditorChanged((meta) => received.push(meta));

        // The adapter passes the group's disposable straight through.
        expect(subscription).toBe(groupDisposable);
        expect(registered).toBeDefined();

        // Active editor present → its meta is forwarded.
        registered!({ absoluteFilePath: "/a/b.ts", languageId: "typescript", isModified: false });
        // No active editor → nulls are forwarded.
        registered!(null);

        expect(received).toEqual([
            { fileName: "/a/b.ts", languageId: "typescript", isDirty: false },
            { fileName: null, languageId: null, isDirty: false },
        ]);
    });
});
