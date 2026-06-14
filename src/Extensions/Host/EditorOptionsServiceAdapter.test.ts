import { describe, expect, it, vi } from "vitest";

import type { EditorGroupController } from "../../Controllers/EditorGroupController.ts";

import { EditorOptionsServiceAdapter } from "./EditorOptionsServiceAdapter.ts";

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
        expect(() => adapter.setActiveEditorOptions({ tabSize: 2 })).not.toThrow();
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

    it("onActiveEditorChanged() forwards the editor's file path, and null when there is no editor", () => {
        let registered: ((editor: unknown) => void) | undefined;
        const groupDisposable = { dispose: vi.fn() };
        const group = {
            onActiveEditorChanged: (cb: (editor: unknown) => void) => {
                registered = cb;
                return groupDisposable;
            },
        } as unknown as EditorGroupController;
        const adapter = new EditorOptionsServiceAdapter(group);

        const received: (string | null)[] = [];
        const subscription = adapter.onActiveEditorChanged((filePath) => received.push(filePath));

        // The adapter passes the group's disposable straight through.
        expect(subscription).toBe(groupDisposable);
        expect(registered).toBeDefined();

        // Active editor present → its absoluteFilePath is forwarded.
        registered!({ absoluteFilePath: "/a/b.ts" });
        // No active editor → null is forwarded.
        registered!(null);

        expect(received).toEqual(["/a/b.ts", null]);
    });
});
