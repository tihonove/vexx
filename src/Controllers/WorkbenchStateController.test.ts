import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUserDataPaths, resolveWorkspaceStatePath } from "../Common/UserDataPaths.ts";
import { loadState, StateService } from "../Configuration/StateService.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";

import type { EditorService } from "../Workbench/Services/EditorService.ts";
import {
    OPEN_EDITORS_STATE,
    PANEL_HEIGHT_STATE,
    PANEL_VISIBLE_STATE,
    SIDEBAR_VISIBLE_STATE,
    SIDEBAR_WIDTH_STATE,
} from "../Workbench/Services/StateKeys.ts";
import { WorkbenchStateController } from "./WorkbenchStateController.ts";

/** Минимальный дублёр EditorService — только методы, что дёргает координатор. */
class FakeGroup {
    public opened: { path: string; focus: boolean }[] = [];
    public activated: { index: number; focus: boolean }[] = [];
    private paths: string[] = [];
    private active = -1;

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
    public get editorCount(): number {
        return this.paths.length;
    }
    public get activeIndex(): number {
        return this.active;
    }
}

describe("WorkbenchStateController", () => {
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

    function make(layout: WorkbenchLayoutElement): WorkbenchStateController {
        return new WorkbenchStateController(state, group as unknown as EditorService, layout);
    }

    describe("layout", () => {
        it("restores saved layout onto the element", () => {
            state.store(SIDEBAR_WIDTH_STATE, 44);
            state.store(SIDEBAR_VISIBLE_STATE, false);
            state.store(PANEL_HEIGHT_STATE, 7);
            state.store(PANEL_VISIBLE_STATE, true);

            const layout = new WorkbenchLayoutElement();
            make(layout).restoreLayout();

            expect(layout.getLeftPanelWidth()).toBe(44);
            expect(layout.getLeftPanelVisible()).toBe(false);
            expect(layout.getBottomPanelHeight()).toBe(7);
            expect(layout.getBottomPanelVisible()).toBe(true);
        });

        it("applies descriptor defaults when nothing is stored", () => {
            const layout = new WorkbenchLayoutElement();
            layout.setLeftPanelWidth(99); // diverge, then restore should reset to default 30
            make(layout).restoreLayout();
            expect(layout.getLeftPanelWidth()).toBe(30);
            expect(layout.getBottomPanelVisible()).toBe(false);
        });

        it("captures the element's current layout into the store", () => {
            const layout = new WorkbenchLayoutElement();
            layout.setLeftPanelWidth(50);
            layout.setLeftPanelVisible(false);
            layout.setBottomPanelHeight(9);
            layout.setBottomPanelVisible(true);

            make(layout).captureLayout();

            expect(state.get(SIDEBAR_WIDTH_STATE)).toBe(50);
            expect(state.get(SIDEBAR_VISIBLE_STATE)).toBe(false);
            expect(state.get(PANEL_HEIGHT_STATE)).toBe(9);
            expect(state.get(PANEL_VISIBLE_STATE)).toBe(true);
        });

        it("suppresses auto-capture while restoring, but captures afterwards", () => {
            state.store(SIDEBAR_WIDTH_STATE, 40);
            const layout = new WorkbenchLayoutElement();
            const ctrl = make(layout);
            // Wire capture-on-change like AppController does — restore must not echo back.
            layout.onDidChangeLayout = () => ctrl.captureLayout();

            ctrl.restoreLayout();
            expect(layout.getLeftPanelWidth()).toBe(40);

            // A genuine post-restore change still writes through.
            layout.setLeftPanelWidth(55);
            expect(state.get(SIDEBAR_WIDTH_STATE)).toBe(55);
        });

        it("round-trips layout capture → restore", () => {
            const src = new WorkbenchLayoutElement();
            src.setLeftPanelWidth(37);
            src.setBottomPanelVisible(true);
            make(src).captureLayout();

            const dst = new WorkbenchLayoutElement();
            make(dst).restoreLayout();
            expect(dst.getLeftPanelWidth()).toBe(37);
            expect(dst.getBottomPanelVisible()).toBe(true);
        });
    });

    describe("open editors", () => {
        it("captures open files with the active index relative to the file list", () => {
            group.setState(["/a.ts", "/b.ts", "/c.ts"], 2);
            make(new WorkbenchLayoutElement()).captureOpenEditors();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: ["/a.ts", "/b.ts", "/c.ts"], activeIndex: 2 });
        });

        it("stores activeIndex -1 when the group is empty", () => {
            group.setState([], -1);
            make(new WorkbenchLayoutElement()).captureOpenEditors();
            expect(state.get(OPEN_EDITORS_STATE)).toEqual({ files: [], activeIndex: -1 });
        });

        it("restores existing files and re-activates the saved active file", () => {
            ws.writeFile("a.ts", "A");
            ws.writeFile("b.ts", "B");
            const a = ws.path("a.ts");
            const b = ws.path("b.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a, b, "/gone/missing.ts"], activeIndex: 1 });

            make(new WorkbenchLayoutElement()).restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a, b]); // missing filtered out
            expect(group.opened.every((o) => o.focus === false)).toBe(true);
            expect(group.activated).toEqual([{ index: 1, focus: false }]); // b survives at index 1
        });

        it("falls back to the first tab when the saved active file is gone", () => {
            ws.writeFile("a.ts", "A");
            const a = ws.path("a.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a, "/gone/x.ts"], activeIndex: 1 });

            make(new WorkbenchLayoutElement()).restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a]);
            expect(group.activated).toEqual([{ index: 0, focus: false }]);
        });

        it("activates the first tab when the snapshot has no valid active index", () => {
            ws.writeFile("a.ts", "A");
            const a = ws.path("a.ts");
            state.store(OPEN_EDITORS_STATE, { files: [a], activeIndex: -1 });

            make(new WorkbenchLayoutElement()).restoreOpenEditors();

            expect(group.opened.map((o) => o.path)).toEqual([a]);
            expect(group.activated).toEqual([{ index: 0, focus: false }]);
        });

        it("opens nothing and activates nothing when no saved file exists", () => {
            state.store(OPEN_EDITORS_STATE, { files: ["/gone/x.ts"], activeIndex: 0 });
            make(new WorkbenchLayoutElement()).restoreOpenEditors();
            expect(group.opened).toEqual([]);
            expect(group.activated).toEqual([]);
        });

        it("does nothing on an empty snapshot", () => {
            make(new WorkbenchLayoutElement()).restoreOpenEditors();
            expect(group.opened).toEqual([]);
            expect(group.activated).toEqual([]);
        });
    });

    it("routes workspace-scoped state to the opened project's store", () => {
        const paths = resolveUserDataPaths({ homedir: "/never", userDataDir: ws.dir });
        const ctrl = make(new WorkbenchLayoutElement());
        ctrl.openWorkspace("/projects/gamma");
        group.setState(["/projects/gamma/x.ts"], 0);
        ctrl.captureOpenEditors();
        state.flushSync();

        const stateFile = resolveWorkspaceStatePath(paths.workspaceStorageDir, "/projects/gamma");
        const onDisk = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
        expect(onDisk["workbench.editors.openEditors"]).toEqual({ files: ["/projects/gamma/x.ts"], activeIndex: 0 });
    });
});
