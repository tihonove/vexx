import { describe, expect, it, vi } from "vitest";

import type { ServiceAccessor } from "../../../platform/instantiation/common/diContainer.ts";
import { SearchComponentDIToken } from "../../contrib/search/browser/searchComponent.ts";
import { LayoutServiceDIToken } from "../../services/layout/browser/layoutService.ts";
import { SEARCH_VIEW_ID, SidebarServiceDIToken } from "../parts/sidebar/sidebarService.ts";

import { showSearchAction } from "./searchActions.ts";

describe("showSearchAction", () => {
    it("is bound to the Search view id, the View menu, and Ctrl+Shift+F", () => {
        expect(showSearchAction.id).toBe(SEARCH_VIEW_ID);
        expect(showSearchAction.keybinding).toBeDefined();
        expect(showSearchAction.menus?.[0]).toMatchObject({ group: "3_views" });
    });

    it("activates the Search view, reveals the sidebar, and focuses the query", () => {
        const sidebar = { setActiveView: vi.fn() };
        const layout = { setSidebarVisible: vi.fn() };
        const search = { focus: vi.fn() };
        const accessor = {
            get(token: unknown) {
                if (token === SidebarServiceDIToken) return sidebar;
                if (token === LayoutServiceDIToken) return layout;
                if (token === SearchComponentDIToken) return search;
                throw new Error("unexpected token");
            },
        } as unknown as ServiceAccessor;

        showSearchAction.run(accessor);

        expect(sidebar.setActiveView).toHaveBeenCalledWith(SEARCH_VIEW_ID);
        expect(layout.setSidebarVisible).toHaveBeenCalledWith(true);
        expect(search.focus).toHaveBeenCalled();
    });
});
