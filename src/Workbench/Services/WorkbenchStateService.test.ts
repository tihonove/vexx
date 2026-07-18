import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUserDataPaths, resolveWorkspaceStatePath } from "../../Common/UserDataPaths.ts";
import { loadState, StateService } from "../../Configuration/StateService.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";

import type { EditorService } from "./EditorService.ts";
import { OPEN_EDITORS_STATE } from "./StateKeys.ts";
import { WorkbenchStateService } from "./WorkbenchStateService.ts";

/** Минимальный дублёр EditorService — только методы, что дёргает сервис. */
class FakeGroup {
    public opened: { path: string; focus: boolean }[] = [];
    public activated: { index: number; focus: boolean }[] = [];
    private paths: string[] = [];
    private active = -1;
    private listeners: (() => void)[] = [];

    public setState(paths: string[], active: number): void {
        this.paths = paths;
        this.active = active;
    }

    public openFile(path: string, { focus = true }: { focus?: boolean } = {}): void {
        this.opened.push({ path, focus });
    }
    public activateTab(index: number, { focus = true }: { focus?: boolean } = {}): void {
        this.activated.push({ index, focus });
    }
    public getOpenFilePaths(): string[] {
        return this.paths;
    }
    public getActiveEditor(): { absoluteFilePath: string | null } | null {
        return this.active >= 0 ? { absoluteFilePath: this.paths[this.active] } : null;
    }
    public onActiveEditorChanged(listener: () => void): { dispose(): void } {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter((l) => l !== listener);
            },
        };
    }
    /** Эмулирует смену активного редактора (write-through подписка сервиса). */
    public fireActiveEditorChanged(): void {
        for (const listener of [...this.listeners]) listener();
    }
    public get editorCount(): number {
        return this.paths.length;
    }
    public get activeIndex(): number {
        return this.active;
    }
}

describe("WorkbenchStateService", () => {
    let ws: ITempWorkspace;
    let state: StateService;
    let group: FakeGroup;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-wbstate-" });
        state = loadState(resolveUserDataPaths({ homedir: "/never", userDataDir: ws.dir }));
        group = new FakeGroup();
    });

    afterEach(() => {
        ws.dispose();
    });

    function make(): WorkbenchStateService {
        return new WorkbenchStateService(state, group as unknown as EditorService);
    }

    describe("open editors", () => {
        it("captures open files with the active index relative to the file list", () => {
            group.setState(["/a.ts", "/b.ts", "/c.ts"], 2);
            make().captureOpenEditors();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: ["/a.ts", "/b.ts", "/c.ts"], activeIndex: 2 });
        });

        it("stores activeIndex -1 when the group is empty", () => {
            group.setState([], -1);
            make().captureOpenEditors();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: [], activeIndex: -1 });
        });

        it("auto-captures on the group's active-editor change (write-through)", () => {
            const service = make();
            group.setState(["/a.ts", "/b.ts"], 0);
            group.fireActiveEditorChanged();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: ["/a.ts", "/b.ts"], activeIndex: 0 });

            // Подписка снимается вместе с сервисом.
            service.dispose();
            group.setState(["/c.ts"], 0);
            group.fireActiveEditorChanged();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: ["/a.ts", "/b.ts"], activeIndex: 0 });
        });

        it("restores existing files and re-activates the saved active file", () => {
            ws.writeFile("a.ts", "A");
            ws.writeFile("b.ts", "B");
            const a = ws.path("a.ts");
            const b = ws.path("b.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a, b, "/gone/missing.ts"], activeIndex: 1 });

            make().restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a, b]); // missing filtered out
            expect(group.opened.every((o) => o.focus === false)).toBe(true);
            expect(group.activated).toEqual([{ index: 1, focus: false }]); // b survives at index 1
        });

        it("falls back to the first tab when the saved active file is gone", () => {
            ws.writeFile("a.ts", "A");
            const a = ws.path("a.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a, "/gone/x.ts"], activeIndex: 1 });

            make().restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a]);
            expect(group.activated).toEqual([{ index: 0, focus: false }]);
        });

        it("activates the first tab when the snapshot has no valid active index", () => {
            ws.writeFile("a.ts", "A");
            const a = ws.path("a.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a], activeIndex: -1 });

            make().restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a]);
            expect(group.activated).toEqual([{ index: 0, focus: false }]);
        });

        it("opens nothing and activates nothing when no saved file exists", () => {
            state.store(OPEN_EDITORS_STATE, { files: ["/gone/x.ts"], activeIndex: 0 });
            make().restoreOpenEditors();
            expect(group.opened).toEqual([]);
            expect(group.activated).toEqual([]);
        });

        it("does nothing on an empty snapshot", () => {
            make().restoreOpenEditors();
            expect(group.opened).toEqual([]);
            expect(group.activated).toEqual([]);
        });
    });

    it("routes workspace-scoped state to the opened project's store", () => {
        const paths = resolveUserDataPaths({ homedir: "/never", userDataDir: ws.dir });
        const service = make();
        service.openWorkspace("/projects/gamma");
        group.setState(["/projects/gamma/x.ts"], 0);
        service.captureOpenEditors();
        state.flushSync();

        const stateFile = resolveWorkspaceStatePath(paths.workspaceStorageDir, "/projects/gamma");
        const onDisk = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
        expect(onDisk["workbench.editors.openEditors"]).toEqual({ files: ["/projects/gamma/x.ts"], activeIndex: 0 });
    });
});
