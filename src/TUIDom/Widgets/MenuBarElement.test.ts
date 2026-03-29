import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TuiApplication } from "../TuiApplication.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { BodyElement } from "./BodyElement.ts";
import type { MenuBarItem } from "./MenuBarElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";
import { VStackElement } from "./VStackElement.ts";

class FocusableChild extends TUIElement {
    public constructor() {
        super();
        this.tabIndex = 0;
    }

    public render(): void {
        // noop
    }
}

function renderMenuBar(
    items: MenuBarItem[],
    width = 30,
    height = 10,
): { backend: MockTerminalBackend; menuBar: MenuBarElement } {
    const menuBar = new MenuBarElement(items);
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    menuBar.globalPosition = new Point(0, 0);
    menuBar.performLayout(BoxConstraints.tight(size));
    menuBar.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return { backend, menuBar };
}

function setupWithBody(
    items: MenuBarItem[],
    childCount = 2,
    width = 30,
    height = 15,
): {
    backend: MockTerminalBackend;
    app: TuiApplication;
    menuBar: MenuBarElement;
    children: FocusableChild[];
    body: BodyElement;
} {
    const backend = new MockTerminalBackend(new Size(width, height));
    const app = new TuiApplication(backend);

    const body = new BodyElement();
    const menuBar = new MenuBarElement(items);
    const stack = new VStackElement();

    const children: FocusableChild[] = [];
    for (let i = 0; i < childCount; i++) {
        const child = new FocusableChild();
        stack.addChild(child, { width: "fill", height: 3 });
        children.push(child);
    }

    body.setMenuBar(menuBar);
    body.setContent(stack);
    app.root = body;
    app.run();

    return { backend, app, menuBar, children, body };
}

function simpleItems(): MenuBarItem[] {
    return [
        { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
        { label: "Edit", entries: [{ label: "Undo" }, { label: "Redo" }] },
        { label: "View", entries: [{ label: "Zoom In" }, { label: "Zoom Out" }] },
    ];
}

describe("MenuBarElement", () => {
    describe("rendering", () => {
        it("renders menu bar with item labels", () => {
            const { backend } = renderMenuBar(simpleItems());
            const firstLine = backend.getTextAt(new Point(0, 0), 30);
            expect(firstLine).toContain("File");
            expect(firstLine).toContain("Edit");
            expect(firstLine).toContain("View");
        });

        it("renders items as ' Label ' with padding", () => {
            const { backend } = renderMenuBar(simpleItems());
            const firstLine = backend.getTextAt(new Point(0, 0), 30);
            expect(firstLine).toContain(" File ");
            expect(firstLine).toContain(" Edit ");
            expect(firstLine).toContain(" View ");
        });

        it("fills full width with spaces on the bar row", () => {
            const { backend } = renderMenuBar(simpleItems(), 40, 5);
            const firstLine = backend.getTextAt(new Point(0, 0), 40);
            expect(firstLine.length).toBe(40);
            for (const ch of firstLine) {
                expect(ch).not.toBe("\0");
            }
        });

        it("renders items at correct horizontal positions", () => {
            const { backend } = renderMenuBar(
                [
                    { label: "AB", entries: [] },
                    { label: "CD", entries: [] },
                ],
                20,
                3,
            );
            const firstLine = backend.getTextAt(new Point(0, 0), 20);
            expect(firstLine.slice(0, 4)).toBe(" AB ");
            expect(firstLine.slice(4, 8)).toBe(" CD ");
        });
    });

    describe("focus management", () => {
        it("menuBar is focusable (tabIndex = 0)", () => {
            const { menuBar } = setupWithBody(simpleItems());
            expect(menuBar.tabIndex).toBe(0);
        });

        it("Tab focuses menuBar first (before content children)", () => {
            const { backend, menuBar, children } = setupWithBody(simpleItems());

            backend.sendKey("Tab");
            expect(menuBar.isFocused).toBe(true);
            expect(children[0].isFocused).toBe(false);
        });

        it("focus sets activeIndex to 0 when no item was selected", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab");
            expect(menuBar.isFocused).toBe(true);
            expect(menuBar.activeIndex).toBe(0);
        });

        it("focus does not open popup", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab");
            expect(menuBar.isFocused).toBe(true);
            expect(menuBar.activeIndex).toBe(0);
            // No popup children
            expect(menuBar.getChildren().length).toBe(0);
        });

        it("Tab past menuBar focuses first content child", () => {
            const { backend, menuBar, children } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar
            expect(menuBar.isFocused).toBe(true);

            backend.sendKey("Tab"); // child[0]
            expect(menuBar.isFocused).toBe(false);
            expect(children[0].isFocused).toBe(true);
        });

        it("blur deactivates menuBar", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar focused
            expect(menuBar.activeIndex).toBe(0);

            backend.sendKey("Tab"); // focus moves away
            expect(menuBar.isFocused).toBe(false);
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("remembers previous focused element on focus", () => {
            const { backend, menuBar, children } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar
            backend.sendKey("Tab"); // child[0]
            expect(children[0].isFocused).toBe(true);

            backend.sendKey("Tab"); // child[1]

            // Now focus menuBar via Shift+Tab cycling
            backend.sendKey("Shift+Tab"); // child[0]
            backend.sendKey("Shift+Tab"); // menuBar
            expect(menuBar.isFocused).toBe(true);
        });
    });

    describe("mnemonic interception", () => {
        it("Alt+letter on focused child opens menu on menuBar", () => {
            const { backend, menuBar, children } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar
            backend.sendKey("Tab"); // child[0]
            expect(children[0].isFocused).toBe(true);

            backend.sendKey("Alt+f");
            expect(menuBar.isFocused).toBe(true);
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(1); // popup open
        });

        it("mnemonic opens correct menu item", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar
            backend.sendKey("Tab"); // child[0]

            backend.sendKey("Alt+e");
            expect(menuBar.activeIndex).toBe(1);
        });

        it("mnemonic uses explicit mnemonic property", () => {
            const items: MenuBarItem[] = [
                { label: "File", mnemonic: "f", entries: [] },
                { label: "Edit", mnemonic: "x", entries: [] },
            ];
            const { backend, menuBar } = setupWithBody(items);

            backend.sendKey("Tab");
            backend.sendKey("Tab");

            backend.sendKey("Alt+x");
            expect(menuBar.activeIndex).toBe(1);
        });

        it("mnemonic match is case-insensitive", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Alt+F");
            expect(menuBar.activeIndex).toBe(0);
        });

        it("does not match mnemonic without Alt", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("f");
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("does not match mnemonic with Ctrl+Alt", () => {
            const { menuBar, children } = setupWithBody(simpleItems());

            children[0].focus();
            children[0].dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true, ctrlKey: true }));
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("switching menu with mnemonic while another is open", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Alt+f");
            expect(menuBar.activeIndex).toBe(0);

            backend.sendKey("Alt+e");
            expect(menuBar.activeIndex).toBe(1);
        });
    });

    describe("keyboard navigation", () => {
        it("ArrowRight moves highlight to next item (no popup)", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar focused, activeIndex=0
            expect(menuBar.activeIndex).toBe(0);

            backend.sendKey("ArrowRight");
            expect(menuBar.activeIndex).toBe(1);
            expect(menuBar.getChildren().length).toBe(0); // no popup
        });

        it("ArrowLeft moves highlight to previous item (no popup)", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab");
            backend.sendKey("ArrowRight"); // activeIndex=1

            backend.sendKey("ArrowLeft");
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(0);
        });

        it("ArrowRight wraps from last to first", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // activeIndex=0
            backend.sendKey("ArrowRight"); // 1
            backend.sendKey("ArrowRight"); // 2

            backend.sendKey("ArrowRight"); // wraps to 0
            expect(menuBar.activeIndex).toBe(0);
        });

        it("ArrowLeft wraps from first to last", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // activeIndex=0

            backend.sendKey("ArrowLeft"); // wraps to 2
            expect(menuBar.activeIndex).toBe(2);
        });

        it("ArrowDown opens popup for current item", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // activeIndex=0
            expect(menuBar.getChildren().length).toBe(0);

            backend.sendKey("ArrowDown");
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(1); // popup open
        });

        it("Enter opens popup for current item", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab");
            backend.sendKey("Enter");
            expect(menuBar.getChildren().length).toBe(1);
        });

        it("ArrowRight with popup open switches to next menu popup", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Alt+f"); // open File popup
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(1);

            backend.sendKey("ArrowRight");
            expect(menuBar.activeIndex).toBe(1);
            expect(menuBar.getChildren().length).toBe(1); // popup still open (different menu)
        });

        it("ArrowLeft with popup open switches to previous menu popup", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Alt+e"); // open Edit popup
            expect(menuBar.activeIndex).toBe(1);

            backend.sendKey("ArrowLeft");
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(1);
        });

        it("ignores ArrowLeft/Right when no focus", () => {
            const { menuBar } = setupWithBody(simpleItems());

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowRight" }));
            expect(menuBar.activeIndex).toBe(-1);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowLeft" }));
            expect(menuBar.activeIndex).toBe(-1);
        });
    });

    describe("escape behavior", () => {
        it("Escape from popup closes popup but keeps highlight", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Alt+f"); // open File popup
            expect(menuBar.getChildren().length).toBe(1);

            backend.sendKey("Escape");
            expect(menuBar.getChildren().length).toBe(0); // popup closed
            expect(menuBar.activeIndex).toBe(0); // highlight remains
            expect(menuBar.isFocused).toBe(true); // still focused
        });

        it("second Escape returns focus to previous element", () => {
            const { backend, menuBar, children } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar
            backend.sendKey("Tab"); // child[0]
            expect(children[0].isFocused).toBe(true);

            backend.sendKey("Alt+f"); // mnemonic → menuBar focused, popup open
            expect(menuBar.isFocused).toBe(true);

            backend.sendKey("Escape"); // close popup, keep highlight
            expect(menuBar.isFocused).toBe(true);
            expect(menuBar.activeIndex).toBe(0);

            backend.sendKey("Escape"); // return focus to child[0]
            expect(menuBar.isFocused).toBe(false);
            expect(menuBar.activeIndex).toBe(-1);
            expect(children[0].isFocused).toBe(true);
        });

        it("Escape without previous element just blurs", () => {
            const { backend, menuBar } = setupWithBody(simpleItems());

            backend.sendKey("Tab"); // menuBar (no previous)
            expect(menuBar.isFocused).toBe(true);

            backend.sendKey("Escape"); // no popup, no previous → blur
            expect(menuBar.isFocused).toBe(false);
            expect(menuBar.activeIndex).toBe(-1);
        });
    });

    describe("dropdown interaction", () => {
        it("renders dropdown menu when active", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }, { label: "Open" }] }];
            const { backend } = setupWithBody(items, 0, 20, 8);

            backend.sendKey("Alt+f");

            expectScreen(
                backend,
                screen`
                     File              
                    ┌──────┐           
                    │ New  │           
                    │ Open │           
                    └──────┘           
                `,
            );
        });

        it("navigates dropdown with ArrowDown", () => {
            const items: MenuBarItem[] = [
                { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
            ];
            const { backend, menuBar } = setupWithBody(items, 0, 20, 10);

            backend.sendKey("Alt+f");
            backend.sendKey("ArrowDown");
            expect(menuBar.activeIndex).toBe(0); // menu bar stays on File
        });

        it("calls onSelect and fully deactivates on Enter", () => {
            const onNew = vi.fn();
            const items: MenuBarItem[] = [
                { label: "File", entries: [{ label: "New", onSelect: onNew }, { label: "Open" }] },
            ];
            const { backend, menuBar } = setupWithBody(items, 0, 20, 10);

            backend.sendKey("Alt+f");
            expect(menuBar.activeIndex).toBe(0);

            backend.sendKey("Enter");

            expect(onNew).toHaveBeenCalledOnce();
            expect(menuBar.activeIndex).toBe(-1);
            expect(menuBar.isFocused).toBe(false);
        });

        it("Escape in popup closes popup but keeps bar focused", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }] }];
            const { backend, menuBar } = setupWithBody(items, 0, 20, 10);

            backend.sendKey("Alt+f");
            expect(menuBar.activeIndex).toBe(0);
            expect(menuBar.getChildren().length).toBe(1);

            backend.sendKey("Escape");
            expect(menuBar.activeIndex).toBe(0); // highlight stays
            expect(menuBar.getChildren().length).toBe(0); // popup closed
            expect(menuBar.isFocused).toBe(true);
        });
    });
});
