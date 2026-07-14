import { describe, expect, it } from "vitest";

import { Size } from "../vs/base/common/geometry.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../vs/base/tui/events/tuiMouseEvent.ts";
import { BodyElement } from "../vs/base/tui/bodyElement.ts";
import type { QuickPickItem } from "../vs/platform/quickinput/tui/quickPickElement.ts";

import { QuickInputController } from "./QuickInputController.ts";

function createController(): { controller: QuickInputController; body: BodyElement; testApp: TestApp } {
    const controller = new QuickInputController();
    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);
    return { controller, body, testApp };
}

function outsideClick(body: BodyElement): void {
    body.dispatchEvent(
        new TUIMouseEvent("mousedown", { screenX: 0, screenY: 0, localX: 0, localY: 0, button: "left" }),
    );
}

const ITEMS: QuickPickItem[] = [
    { label: "Dark Modern", description: "dark" },
    { label: "Dark+", description: "dark" },
    { label: "Monokai", description: "dark" },
    { label: "Light Modern", description: "light" },
];

describe("QuickInputController.quickPick", () => {
    it("opens a visible overlay", () => {
        const { controller, body } = createController();
        void controller.quickPick({ items: ITEMS });
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("resolves with the highlighted item on Enter", async () => {
        const { controller, testApp } = createController();
        const result = controller.quickPick({ items: ITEMS });
        testApp.sendKey("ArrowDown");
        testApp.sendKey("Enter");
        await expect(result).resolves.toMatchObject({ label: "Dark+" });
    });

    it("resolves undefined on Escape", async () => {
        const { controller, testApp } = createController();
        const result = controller.quickPick({ items: ITEMS });
        testApp.sendKey("Escape");
        await expect(result).resolves.toBeUndefined();
    });

    it("resolves undefined on an outside click", async () => {
        const { controller, body } = createController();
        const result = controller.quickPick({ items: ITEMS });
        outsideClick(body);
        await expect(result).resolves.toBeUndefined();
    });

    it("pre-highlights the given activeIndex", async () => {
        const { controller, testApp } = createController();
        const result = controller.quickPick({ items: ITEMS, activeIndex: 2 });
        testApp.sendKey("Enter");
        await expect(result).resolves.toMatchObject({ label: "Monokai" });
    });

    it("fires onDidChangeActive on open and on navigation (live preview)", async () => {
        const { controller, testApp } = createController();
        const seen: (string | undefined)[] = [];
        const result = controller.quickPick({
            items: ITEMS,
            activeIndex: 0,
            onDidChangeActive: (item) => seen.push(item?.label),
        });

        // Fired once for the initial active item...
        expect(seen).toEqual(["Dark Modern"]);
        // ...then again for each navigation step.
        testApp.sendKey("ArrowDown");
        testApp.sendKey("ArrowDown");
        expect(seen).toEqual(["Dark Modern", "Dark+", "Monokai"]);

        testApp.sendKey("Escape");
        await result;
    });

    it("filters items live by label substring", async () => {
        const { controller, testApp } = createController();
        const result = controller.quickPick({ items: ITEMS });
        // Type "light" → only "Light Modern" remains; it becomes the active item.
        for (const ch of "light") testApp.sendKey(ch);
        expect(controller.view.items.map((i) => i.label)).toEqual(["Light Modern"]);
        testApp.sendKey("Enter");
        await expect(result).resolves.toMatchObject({ label: "Light Modern" });
    });

    it("restores the full list when the query is cleared", () => {
        const { controller, testApp } = createController();
        void controller.quickPick({ items: ITEMS });
        for (const ch of "light") testApp.sendKey(ch);
        expect(controller.view.items).toHaveLength(1);

        // Backspace the query empty again → the empty-needle branch returns every item.
        for (const _ch of "light") testApp.sendKey("Backspace");
        expect(controller.view.items.map((i) => i.label)).toEqual(ITEMS.map((i) => i.label));
    });

    it("reports undefined active item when the filter matches nothing", () => {
        const { controller, testApp } = createController();
        const seen: (string | undefined)[] = [];
        void controller.quickPick({ items: ITEMS, onDidChangeActive: (item) => seen.push(item?.label) });
        for (const ch of "zzz") testApp.sendKey(ch);
        expect(controller.view.items).toHaveLength(0);
        expect(seen.at(-1)).toBeUndefined();
    });

    it("supersedes a previous open pick (resolves it undefined)", async () => {
        const { controller, testApp } = createController();
        const first = controller.quickPick({ items: ITEMS });
        const second = controller.quickPick({ items: ITEMS });
        await expect(first).resolves.toBeUndefined();
        testApp.sendKey("Enter");
        await expect(second).resolves.toMatchObject({ label: "Dark Modern" });
    });
});
