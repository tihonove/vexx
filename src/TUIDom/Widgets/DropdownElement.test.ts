import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import type { DropdownOption } from "./DropdownElement.ts";
import { DropdownElement } from "./DropdownElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";

const CHANNELS: DropdownOption[] = [
    { value: "bootstrap", label: "bootstrap" },
    { value: "configuration", label: "configuration" },
    { value: "extensions.host", label: "extensions.host" },
];

function renderDropdown(dropdown: DropdownElement): MockTerminalBackend {
    const size = new Size(dropdown.getMaxIntrinsicWidth(1), 1);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    dropdown.performLayout(BoxConstraints.tight(size));
    dropdown.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

/** Opens the dropdown against a live overlay and returns the hosted PopupMenu. */
function openWithOverlay(dropdown: DropdownElement): { app: TestApp; menu: PopupMenuElement } {
    const app = TestApp.createWithContent(dropdown, new Size(40, 12));
    dropdown.setOverlayLayer(app.root.overlayLayer);
    dropdown.open();
    const menu = app.root.overlayLayer.getItems()[0]?.element as PopupMenuElement;
    return { app, menu };
}

describe("DropdownElement", () => {
    describe("intrinsic size", () => {
        it("sizes to the widest label + padding and arrow", () => {
            const dropdown = new DropdownElement(CHANNELS);
            // longest label "extensions.host" (15) + " " + label + " " + arrow = 19
            expect(dropdown.getMaxIntrinsicWidth(1)).toBe(19);
            expect(dropdown.getMinIntrinsicWidth(1)).toBe(19);
            expect(dropdown.getMaxIntrinsicHeight(19)).toBe(1);
        });

        it("falls back to placeholder width when there are no options", () => {
            const dropdown = new DropdownElement([]);
            dropdown.placeholder = "no channels";
            // "no channels" (11) + 4
            expect(dropdown.getMaxIntrinsicWidth(1)).toBe(15);
        });
    });

    describe("closed rendering", () => {
        // A leading pad space can't survive `screen`'s dedent, so compare the raw row.
        it("shows the current option's label and a drop arrow", () => {
            const dropdown = new DropdownElement([{ value: "bootstrap", label: "bootstrap" }]);
            dropdown.value = "bootstrap";
            expect(renderDropdown(dropdown).screenToString().trimEnd()).toBe(" bootstrap  ▾");
        });

        it("shows the placeholder when there is no value", () => {
            const dropdown = new DropdownElement([]);
            dropdown.placeholder = "Select";
            expect(renderDropdown(dropdown).screenToString().trimEnd()).toBe(" Select  ▾");
        });
    });

    describe("value", () => {
        it("setter updates the display without firing onChange", () => {
            const onChange = vi.fn();
            const dropdown = new DropdownElement(CHANNELS);
            dropdown.onChange = onChange;

            dropdown.value = "configuration";

            expect(dropdown.value).toBe("configuration");
            expect(onChange).not.toHaveBeenCalled();
        });

        it("is a no-op when set to the same value", () => {
            const dropdown = new DropdownElement(CHANNELS);
            dropdown.value = "bootstrap";
            const onChange = vi.fn();
            dropdown.onChange = onChange;
            dropdown.value = "bootstrap";
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe("options", () => {
        it("setter re-syncs intrinsic width and keeps the current value", () => {
            const dropdown = new DropdownElement([{ value: "a", label: "a" }]);
            dropdown.value = "a";

            dropdown.options = [
                { value: "a", label: "a" },
                { value: "long", label: "a-much-longer-label" },
            ];

            expect(dropdown.value).toBe("a");
            expect(dropdown.options.map((o) => o.value)).toEqual(["a", "long"]);
            expect(dropdown.getMaxIntrinsicWidth(1)).toBe("a-much-longer-label".length + 4);
        });
    });

    describe("opening", () => {
        it("opens on Enter / Space / ArrowDown", () => {
            for (const key of ["Enter", " ", "ArrowDown"]) {
                const dropdown = new DropdownElement(CHANNELS);
                const app = TestApp.createWithContent(dropdown, new Size(40, 12));
                dropdown.setOverlayLayer(app.root.overlayLayer);

                dropdown.dispatchEvent(new TUIKeyboardEvent("keydown", { key }));
                expect(dropdown.isOpen(), `key=${key}`).toBe(true);
            }
        });

        it("toggles open/closed on click", () => {
            const dropdown = new DropdownElement(CHANNELS);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);

            const click = (): void => {
                dropdown.dispatchEvent(
                    new TUIMouseEvent("click", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 }),
                );
            };

            click();
            expect(dropdown.isOpen()).toBe(true);
            click();
            expect(dropdown.isOpen()).toBe(false);
        });

        it("closes on Escape", () => {
            const dropdown = new DropdownElement(CHANNELS);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);
            dropdown.open();
            expect(dropdown.isOpen()).toBe(true);

            dropdown.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
            expect(dropdown.isOpen()).toBe(false);
        });

        it("does not open when there are no options", () => {
            const dropdown = new DropdownElement([]);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);
            dropdown.open();
            expect(dropdown.isOpen()).toBe(false);
        });

        it("is a no-op when no overlay layer is wired", () => {
            const dropdown = new DropdownElement(CHANNELS);
            expect(() => dropdown.open()).not.toThrow();
            expect(dropdown.isOpen()).toBe(false);
        });
    });

    describe("selection", () => {
        it("picking an option sets value, fires onChange and closes", () => {
            const onChange = vi.fn();
            const dropdown = new DropdownElement(CHANNELS);
            dropdown.value = "bootstrap";
            dropdown.onChange = onChange;

            const { menu } = openWithOverlay(dropdown);
            // Move onto the second option (configuration) and accept it.
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));

            expect(dropdown.value).toBe("configuration");
            expect(onChange).toHaveBeenCalledWith("configuration");
            expect(dropdown.isOpen()).toBe(false);
        });

        it("picking the already-current option does not fire onChange", () => {
            const onChange = vi.fn();
            const dropdown = new DropdownElement(CHANNELS);
            dropdown.value = "bootstrap";
            dropdown.onChange = onChange;

            const { menu } = openWithOverlay(dropdown);
            // First entry is the current value (bootstrap).
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));

            expect(onChange).not.toHaveBeenCalled();
            expect(dropdown.isOpen()).toBe(false);
        });
    });

    describe("misc", () => {
        it("has a single-row height", () => {
            const dropdown = new DropdownElement(CHANNELS);
            expect(dropdown.getMinIntrinsicHeight(20)).toBe(1);
            expect(dropdown.getMaxIntrinsicHeight(20)).toBe(1);
        });

        it("re-renders on focus and blur", () => {
            const dropdown = new DropdownElement(CHANNELS);
            const app = TestApp.createWithContent(dropdown, new Size(40, 4));
            dropdown.focus();
            expect(app.focusedElement).toBe(dropdown);
            expect(dropdown.isFocused).toBe(true);
            dropdown.blur();
            expect(dropdown.isFocused).toBe(false);
        });

        it("underlines the label while focused (renders without throwing)", () => {
            const dropdown = new DropdownElement([{ value: "bootstrap", label: "bootstrap" }]);
            dropdown.value = "bootstrap";
            const app = TestApp.createWithContent(dropdown, new Size(20, 3));
            dropdown.focus();
            app.render();
            expect(app.backend.screenToString()).toContain("bootstrap");
        });

        it("ignores a click whose default was already prevented", () => {
            const dropdown = new DropdownElement(CHANNELS);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);

            const event = new TUIMouseEvent("click", {
                button: "left",
                screenX: 0,
                screenY: 0,
                localX: 0,
                localY: 0,
            });
            event.preventDefault();
            dropdown.dispatchEvent(event);
            expect(dropdown.isOpen()).toBe(false);
        });

        it("ignores Escape when closed, unknown keys and non-keydown events", () => {
            const dropdown = new DropdownElement(CHANNELS);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);

            dropdown.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" })); // closed → no-op
            dropdown.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" })); // unhandled key
            dropdown.dispatchEvent(new TUIKeyboardEvent("keyup", { key: "Enter" })); // not a keydown
            expect(dropdown.isOpen()).toBe(false);
        });

        it("applies a theme to the opened list without throwing", () => {
            const theme = WorkbenchTheme.fromThemeFile({ name: "t", type: "dark", colors: {} });
            const dropdown = new DropdownElement(CHANNELS);
            dropdown.applyTheme(theme);
            const app = TestApp.createWithContent(dropdown, new Size(40, 12));
            dropdown.setOverlayLayer(app.root.overlayLayer);
            dropdown.open();
            expect(dropdown.isOpen()).toBe(true);
        });

        it("shows the raw value when it is not among the options", () => {
            const dropdown = new DropdownElement([{ value: "x", label: "xxxxxxxx" }]);
            dropdown.value = "zz"; // not in options → falls back to the raw value
            const size = new Size(dropdown.getMaxIntrinsicWidth(1), 1);
            const backend = new MockTerminalBackend(size);
            const term = new TerminalScreen(size);
            dropdown.performLayout(BoxConstraints.tight(size));
            dropdown.render(new RenderContext(term));
            term.flush(backend);
            expect(backend.screenToString()).toContain("zz");
        });
    });
});
