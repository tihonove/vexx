import { describe, expect, it, vi } from "vitest";

import type { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";

import { ThemeService } from "./themeService.ts";

// ThemeService only stores/forwards the theme reference, so a tagged stub is
// sufficient — we assert by identity, not by inspecting WorkbenchTheme internals.
function fakeTheme(tag: string): WorkbenchTheme {
    return { tag } as unknown as WorkbenchTheme;
}

describe("ThemeService", () => {
    it("exposes the initial theme", () => {
        const initial = fakeTheme("a");
        const service = new ThemeService(initial);
        expect(service.theme).toBe(initial);
    });

    it("setTheme swaps the current theme and notifies listeners", () => {
        const service = new ThemeService(fakeTheme("a"));
        const next = fakeTheme("b");
        const listener = vi.fn();

        service.onThemeChange(listener);
        listener.mockClear(); // ignore the immediate initial call

        service.setTheme(next);
        expect(service.theme).toBe(next);
        expect(listener).toHaveBeenCalledWith(next);
    });

    it("onThemeChange invokes the listener immediately with the current theme", () => {
        const initial = fakeTheme("a");
        const service = new ThemeService(initial);
        const listener = vi.fn();
        service.onThemeChange(listener);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(initial);
    });

    it("disposing a subscription stops further notifications (line 35)", () => {
        const service = new ThemeService(fakeTheme("a"));
        const listener = vi.fn();
        const sub = service.onThemeChange(listener);
        listener.mockClear();

        sub.dispose();
        service.setTheme(fakeTheme("b"));

        expect(listener).not.toHaveBeenCalled();
    });

    it("disposing one subscription leaves others active", () => {
        const service = new ThemeService(fakeTheme("a"));
        const keep = vi.fn();
        const drop = vi.fn();
        const keepSub = service.onThemeChange(keep);
        const dropSub = service.onThemeChange(drop);
        keep.mockClear();
        drop.mockClear();

        dropSub.dispose();
        const next = fakeTheme("b");
        service.setTheme(next);

        expect(drop).not.toHaveBeenCalled();
        expect(keep).toHaveBeenCalledWith(next);
        keepSub.dispose();
    });

    it("disposing the same subscription twice is safe", () => {
        const service = new ThemeService(fakeTheme("a"));
        const sub = service.onThemeChange(vi.fn());
        sub.dispose();
        expect(() => {
            sub.dispose();
        }).not.toThrow();
    });
});
