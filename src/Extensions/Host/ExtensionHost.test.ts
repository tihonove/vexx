import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { subprocessSpawnArgsForTests } from "../../TestUtils/ExtensionTestHarness.ts";

import { EditorOptionsServiceAdapter } from "./EditorOptionsServiceAdapter.ts";
import { ExtensionHost } from "./ExtensionHost.ts";
import type { IExtensionRegistration } from "./IExtensionEntry.ts";
import type { IEditorOptionsPatch, IEditorOptionsService, IEditorOptionsState } from "./IEditorOptionsService.ts";

const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url)) + "/__fixtures__";

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

function makeReg(id: string, mainFile: string): IExtensionRegistration {
    return {
        id,
        manifest: { name: id, publisher: "test", version: "0.0.1" },
        mainPath: path.join(FIXTURES_DIR, mainFile),
    };
}

function createHost(svc: IEditorOptionsService): ExtensionHost {
    return new ExtensionHost(svc, { spawnArgs: subprocessSpawnArgsForTests() });
}

async function settle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
}

describe("ExtensionHost (subprocess)", () => {
    it("registerExtension активирует extension через subprocess", async () => {
        const svc = new FakeOptionsService();
        const host = createHost(svc);
        await host.registerExtension(makeReg("noop-a", "noopExtension.cjs"));
        expect(host.extensionCount).toBe(1);
        expect(host.hasExtension("noop-a")).toBe(true);
        host.dispose();
        await settle();
    });

    it("отклоняет повторную регистрацию того же id", async () => {
        const svc = new FakeOptionsService();
        const host = createHost(svc);
        const reg = makeReg("dup", "noopExtension.cjs");
        await host.registerExtension(reg);
        await expect(host.registerExtension(reg)).rejects.toThrow(/already registered/);
        host.dispose();
        await settle();
    });

    it("после dispose registerExtension бросает", async () => {
        const svc = new FakeOptionsService();
        const host = createHost(svc);
        host.dispose();
        await expect(host.registerExtension(makeReg("late", "noopExtension.cjs"))).rejects.toThrow(/disposed/);
    });

    it("unregisterExtension убирает конкретное расширение", async () => {
        const svc = new FakeOptionsService();
        const host = createHost(svc);
        await host.registerExtension(makeReg("x", "noopExtension.cjs"));
        await host.registerExtension(makeReg("y", "noopExtension.cjs"));
        expect(host.extensionCount).toBe(2);
        await host.unregisterExtension("x");
        expect(host.extensionCount).toBe(1);
        expect(host.hasExtension("y")).toBe(true);
        host.dispose();
        await settle();
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
