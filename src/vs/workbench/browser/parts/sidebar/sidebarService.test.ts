import { describe, expect, it, vi } from "vitest";

import type { TUIElement } from "../../../../../../tuidom/dom/tuiElement.ts";
import type { WorkbenchLayoutElement } from "../../../../../../tuidom/ui/workbenchlayout/workbenchLayoutElement.ts";

import { EXPLORER_VIEW_ID, SEARCH_VIEW_ID, SidebarService } from "./sidebarService.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeView(tag: string): TUIElement {
    return { tag } as unknown as TUIElement;
}

function fakeLayout(): { layout: WorkbenchLayoutElement; setLeftPanel: ReturnType<typeof vi.fn> } {
    const setLeftPanel = vi.fn();
    return { layout: { setLeftPanel } as unknown as WorkbenchLayoutElement, setLeftPanel };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SidebarService", () => {
    it("makes the first registered view active by default", () => {
        const service = new SidebarService();
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer"));
        service.setView(SEARCH_VIEW_ID, fakeView("search"));
        expect(service.getActiveViewId()).toBe(EXPLORER_VIEW_ID);
    });

    it("shows the active view when a layout is attached", () => {
        const service = new SidebarService();
        const explorer = fakeView("explorer");
        service.setView(EXPLORER_VIEW_ID, explorer);
        const { layout, setLeftPanel } = fakeLayout();
        service.attachLayout(layout);
        expect(setLeftPanel).toHaveBeenCalledWith(explorer);
    });

    it("does nothing on attach when no view is registered yet", () => {
        const service = new SidebarService();
        const { layout, setLeftPanel } = fakeLayout();
        service.attachLayout(layout);
        expect(setLeftPanel).not.toHaveBeenCalled();
    });

    it("swaps the left panel when the active view changes", () => {
        const service = new SidebarService();
        const explorer = fakeView("explorer");
        const search = fakeView("search");
        const { layout, setLeftPanel } = fakeLayout();
        service.attachLayout(layout);
        service.setView(EXPLORER_VIEW_ID, explorer);
        service.setView(SEARCH_VIEW_ID, search);

        service.setActiveView(SEARCH_VIEW_ID);
        expect(service.getActiveViewId()).toBe(SEARCH_VIEW_ID);
        expect(setLeftPanel).toHaveBeenLastCalledWith(search);
    });

    it("fires onDidChangeActiveView on a real switch", () => {
        const service = new SidebarService();
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer"));
        service.setView(SEARCH_VIEW_ID, fakeView("search"));
        const seen: string[] = [];
        service.onDidChangeActiveView((id) => seen.push(id));
        service.setActiveView(SEARCH_VIEW_ID);
        expect(seen).toEqual([SEARCH_VIEW_ID]);
    });

    it("ignores setActiveView for an unknown or already-active view", () => {
        const service = new SidebarService();
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer"));
        const { layout, setLeftPanel } = fakeLayout();
        service.attachLayout(layout);
        setLeftPanel.mockClear();
        const seen: string[] = [];
        service.onDidChangeActiveView((id) => seen.push(id));

        service.setActiveView("workbench.view.nope"); // unknown
        service.setActiveView(EXPLORER_VIEW_ID); // already active
        expect(setLeftPanel).not.toHaveBeenCalled();
        expect(seen).toEqual([]);
    });

    it("re-applies when the active view's element is replaced (folder switch)", () => {
        const service = new SidebarService();
        const { layout, setLeftPanel } = fakeLayout();
        service.attachLayout(layout);
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer-1"));
        const explorer2 = fakeView("explorer-2");
        service.setView(EXPLORER_VIEW_ID, explorer2);
        expect(setLeftPanel).toHaveBeenLastCalledWith(explorer2);
    });

    it("does not re-apply when an inactive view's element is updated", () => {
        const service = new SidebarService();
        const { layout, setLeftPanel } = fakeLayout();
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer"));
        service.attachLayout(layout);
        setLeftPanel.mockClear();
        service.setView(SEARCH_VIEW_ID, fakeView("search")); // registered but not active
        expect(setLeftPanel).not.toHaveBeenCalled();
    });

    it("disposing a listener stops further notifications", () => {
        const service = new SidebarService();
        service.setView(EXPLORER_VIEW_ID, fakeView("explorer"));
        service.setView(SEARCH_VIEW_ID, fakeView("search"));
        const seen: string[] = [];
        const sub = service.onDidChangeActiveView((id) => seen.push(id));
        sub.dispose();
        service.setActiveView(SEARCH_VIEW_ID);
        expect(seen).toEqual([]);
    });
});
