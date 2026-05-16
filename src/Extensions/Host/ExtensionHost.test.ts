import { describe, expect, it } from "vitest";

import { EditorOptionsServiceAdapter } from "./EditorOptionsServiceAdapter.ts";
import { ExtensionHost } from "./ExtensionHost.ts";
import type { IExtensionEntry, IExtensionRegistration } from "./IExtensionEntry.ts";
import type { IEditorOptionsPatch, IEditorOptionsService, IEditorOptionsState } from "./IEditorOptionsService.ts";

class FakeOptionsService implements IEditorOptionsService {
    public state: IEditorOptionsState | null = { tabSize: 4, insertSpaces: true };
    public patches: IEditorOptionsPatch[] = [];
    public getActiveEditorOptions(): IEditorOptionsState | null {
        return this.state;
    }
    public setActiveEditorOptions(patch: IEditorOptionsPatch): void {
        this.patches.push(patch);
        this.state = { ...(this.state ?? { tabSize: 4, insertSpaces: true }), ...patch };
    }
}

function makeReg(id: string, entry: IExtensionEntry): IExtensionRegistration {
    return { id, manifest: { name: id, publisher: "test", version: "0.0.1" }, entry };
}

describe("ExtensionHost", () => {
    it("registerExtension вызывает activate расширения", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        let activated = false;
        await host.registerExtension(
            makeReg("a", {
                activate(): void {
                    activated = true;
                },
            }),
        );
        expect(activated).toBe(true);
        expect(host.extensionCount).toBe(1);
        host.dispose();
    });

    it("отклоняет повторную регистрацию того же id", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        const reg = makeReg("dup", { activate(): void {} });
        await host.registerExtension(reg);
        await expect(host.registerExtension(reg)).rejects.toThrow(/already registered/);
        host.dispose();
    });

    it("editor.options API проксируется в EditorOptionsService", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        await host.registerExtension(
            makeReg("opts", {
                activate(_ctx, api): void {
                    const editor = api.window.activeTextEditor;
                    if (editor === undefined) return;
                    editor.options = { tabSize: 3, insertSpaces: false };
                },
            }),
        );
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        expect(svc.patches).toEqual([{ tabSize: 3, insertSpaces: false }]);
        host.dispose();
    });

    it("dispose деактивирует и убирает все расширения", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        let deactivated = false;
        await host.registerExtension(
            makeReg("d", {
                activate(): void {},
                deactivate(): void {
                    deactivated = true;
                },
            }),
        );
        host.dispose();
        // dispose асинхронно дожидаем
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        expect(deactivated).toBe(true);
        expect(host.extensionCount).toBe(0);
    });

    it("после dispose registerExtension бросает", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        host.dispose();
        await expect(
            host.registerExtension(makeReg("late", { activate(): void {} })),
        ).rejects.toThrow(/disposed/);
    });

    it("unregisterExtension убирает конкретное расширение", async () => {
        const svc = new FakeOptionsService();
        const host = new ExtensionHost(svc);
        await host.registerExtension(makeReg("x", { activate(): void {} }));
        await host.registerExtension(makeReg("y", { activate(): void {} }));
        expect(host.extensionCount).toBe(2);
        await host.unregisterExtension("x");
        expect(host.extensionCount).toBe(1);
        expect(host.hasExtension("y")).toBe(true);
        host.dispose();
    });
});

describe("EditorOptionsServiceAdapter", () => {
    it("возвращает null когда нет активного редактора", () => {
        const adapter = new EditorOptionsServiceAdapter({
            getActiveEditor: () => null,
        } as never);
        expect(adapter.getActiveEditorOptions()).toBeNull();
        adapter.setActiveEditorOptions({ tabSize: 2 }); // не должно бросать
    });
});
