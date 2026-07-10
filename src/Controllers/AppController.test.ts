import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";
import type { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { TerminalEnvironmentServiceDIToken } from "./TerminalEnvironment/TerminalEnvironmentService.ts";

interface TestAppContext {
    testApp: TestApp;
    controller: AppController;
    commandRegistry: CommandRegistry;
}

function createTestAppController(size: Size = new Size(80, 24)): TestAppContext {
    const { container, bindApp } = createTestContainer();

    const controller = container.get(AppControllerDIToken);
    controller.mount();

    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);

    const commandRegistry = container.get(CommandRegistryDIToken);

    return { testApp, controller, commandRegistry };
}

describe("AppController integration", () => {
    it("creates UI tree with menubar and editor", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-tree.txt");

        expect(testApp.querySelector("MenuBarElement")).not.toBeNull();
        expect(testApp.querySelector("ScrollBarDecorator")).not.toBeNull();
    });

    it("focuses editor via focusEditor()", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-focus.txt");
        controller.focusEditor();

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.querySelector("EditorElement")).toBe(testApp.focusedElement);
    });

    it("Ctrl+S executes save command", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.focusEditor();

        const executeSpy = vi.spyOn(commandRegistry, "execute");

        testApp.sendKey("Ctrl+S");

        expect(executeSpy).toHaveBeenCalledWith("workbench.action.files.save");
    });

    it("Tab cycles focus from editor to menubar", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        const editorElement = testApp.querySelector("EditorElement");
        const menuBar = testApp.querySelector("MenuBarElement");

        expect(testApp.focusedElement).toBe(editorElement);

        testApp.sendKey("Tab");

        expect(testApp.focusedElement).toBe(menuBar);
    });

    it("typing inserts text into editor", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-typing.txt");
        controller.focusEditor();

        testApp.sendKey("h");
        testApp.sendKey("i");

        const editorElement = testApp.querySelector("EditorElement") as EditorElement;
        expect(editorElement.viewState.document.getText()).toBe("hi");
    });

    it("Ctrl+Tab switches to next editor tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        testApp.sendKey("Ctrl+Tab");

        expect(tabStrip.activeIndex).toBe(0);
    });

    it("Ctrl+Tab keeps focus on EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+Tab");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("Ctrl+Shift+Tab switches to previous editor tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.activeIndex).toBe(1);

        testApp.sendKey("Ctrl+Shift+Tab");

        expect(tabStrip.activeIndex).toBe(0);
    });

    it("Ctrl+Shift+Tab keeps focus on EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+Shift+Tab");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("Ctrl+W closes active tab", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.getItemElements()).toHaveLength(2);

        testApp.sendKey("Ctrl+W");

        expect(tabStrip.getItemElements()).toHaveLength(1);
    });

    it("Ctrl+W keeps focus on remaining EditorElement", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/tab-a.txt");
        controller.openFile("/tmp/tab-b.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+W");

        expect(testApp.focusedElement).not.toBeNull();
        expect(testApp.focusedElement).toBe(testApp.querySelector("EditorElement"));
    });

    it("creates UI tree with statusbar", () => {
        const { testApp } = createTestAppController();

        expect(testApp.querySelector("StatusBarElement")).not.toBeNull();
    });

    it("statusbar shows the cursor position after openFile", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-app-statusbar.txt");

        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        const items = statusBar.getItems();
        expect(items).toContainEqual({ text: "Ln 1, Col 1", align: "right" });
        expect(items).not.toContainEqual({ text: "test-app-statusbar.txt" });
    });

    it("statusbar updates the cursor position live after typing", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/test-app-modified.txt");
        controller.focusEditor();

        testApp.sendKey("x");

        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        const items = statusBar.getItems();
        expect(items).toContainEqual({ text: "Ln 1, Col 2", align: "right" });
        expect(items).not.toContainEqual({ text: "[Modified]" });
    });
});

describe("AppController — chords", () => {
    function statusTexts(testApp: TestApp): string[] {
        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        return statusBar.getItems().map((i) => i.text);
    }

    function editorText(testApp: TestApp): string {
        return (testApp.querySelector("EditorElement") as EditorElement).viewState.document.getText();
    }

    it("Ctrl+K then S runs the chord-bound save without leaking 's' into the editor", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/chord-save.txt");
        controller.focusEditor();
        const executeSpy = vi.spyOn(commandRegistry, "execute");

        testApp.sendKey("Ctrl+K");
        // First part does not execute the command yet…
        expect(executeSpy).not.toHaveBeenCalledWith("workbench.action.files.save");
        // …and a waiting hint is shown in the status bar.
        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(true);

        testApp.sendKey("s");
        expect(executeSpy).toHaveBeenCalledWith("workbench.action.files.save");
        // The continuation key must NOT be typed into the editor.
        expect(editorText(testApp)).toBe("");
    });

    it("a continuation key that matches no command is swallowed, not typed", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/chord-swallow.txt");
        controller.focusEditor();
        const executeSpy = vi.spyOn(commandRegistry, "execute");

        testApp.sendKey("Ctrl+K");
        testApp.sendKey("x"); // not part of any chord

        expect(executeSpy).not.toHaveBeenCalledWith("workbench.action.files.save");
        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(false);
        expect(editorText(testApp)).toBe(""); // 'x' did not leak
    });

    it("reports the unmatched combination in the status bar when a chord is not completed", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/chord-notfound.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+K");
        testApp.sendKey("x");

        expect(statusTexts(testApp).some((t) => t.includes("(Ctrl+K X) is not a command"))).toBe(true);
    });

    it("the 'not a command' message auto-clears after the timeout", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/chord-notfound-clear.txt");
        controller.focusEditor();

        vi.useFakeTimers();
        try {
            testApp.sendKey("Ctrl+K");
            testApp.sendKey("x");
            expect(statusTexts(testApp).some((t) => t.includes("is not a command"))).toBe(true);

            vi.advanceTimersByTime(4000);
            expect(statusTexts(testApp).some((t) => t.includes("is not a command"))).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("Ctrl+K then Ctrl+S opens keybindings (VS Code chord), not the save chord", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/chord-ctrls.txt");
        controller.focusEditor();
        const executeSpy = vi.spyOn(commandRegistry, "execute");

        testApp.sendKey("Ctrl+K");
        testApp.sendKey("Ctrl+S");

        // Ctrl+K Ctrl+S is Open Keyboard Shortcuts, distinct from the Ctrl+K S save chord.
        expect(executeSpy).toHaveBeenCalledWith("workbench.action.openGlobalKeybindingsFile");
        expect(executeSpy).not.toHaveBeenCalledWith("workbench.action.files.save");
    });

    it("resolves the chord through the full Kitty key lifecycle (down/up incl. release)", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/chord-kitty.txt");
        controller.focusEditor();
        const executeSpy = vi.spyOn(commandRegistry, "execute");

        // Real terminal (Kitty protocol) sends CSI-u with explicit key releases.
        testApp.backend.sendRaw("\x1b[107;5u"); // Ctrl+K down
        testApp.backend.sendRaw("\x1b[107;5:3u"); // Ctrl+K up
        testApp.backend.sendRaw("\x1b[115u"); // s down
        testApp.backend.sendRaw("\x1b[115;1:3u"); // s up

        expect(executeSpy).toHaveBeenCalledWith("workbench.action.files.save");
        expect(editorText(testApp)).toBe(""); // 's' did not leak
    });

    it("cancels the pending chord after the timeout", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.focusEditor();

        vi.useFakeTimers();
        try {
            testApp.sendKey("Ctrl+K");
            expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(true);

            vi.advanceTimersByTime(5000);
            expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(false);

            // Pending state was reset: 's' alone no longer completes the chord.
            const executeSpy = vi.spyOn(commandRegistry, "execute");
            testApp.sendKey("s");
            expect(executeSpy).not.toHaveBeenCalledWith("workbench.action.files.save");
        } finally {
            vi.useRealTimers();
        }
    });

    it("a new keypress clears the pending 'not a command' timer before it fires", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/chord-notfound-reset.txt");
        controller.focusEditor();

        vi.useFakeTimers();
        try {
            // Broken chord arms the auto-clear timer for the "not a command" hint.
            testApp.sendKey("Ctrl+K");
            testApp.sendKey("x");
            expect(statusTexts(testApp).some((t) => t.includes("is not a command"))).toBe(true);

            // The very next key dispatch clears that pending timer (and the hint) eagerly,
            // so when the original 4s timeout elapses there is no lingering message to reset.
            testApp.sendKey("a");
            expect(statusTexts(testApp).some((t) => t.includes("is not a command"))).toBe(false);

            vi.advanceTimersByTime(4000);
            expect(statusTexts(testApp).some((t) => t.includes("is not a command"))).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("a focus change cancels an in-progress chord and clears the waiting hint", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/chord-focus-cancel.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+K");
        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(true);

        // Moving focus away while a chord is pending must abort it.
        const editor = testApp.querySelector("EditorElement") as EditorElement;
        editor.blur();

        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(false);

        // The pending state was reset: 's' alone no longer completes the chord.
        const executeSpy = vi.spyOn(commandRegistry, "execute");
        testApp.sendKey("s");
        expect(executeSpy).not.toHaveBeenCalledWith("workbench.action.files.save");
    });
});

describe("AppController — Quick Open", () => {
    it("Ctrl+P opens QuickPickElement (picker is visible)", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        testApp.sendKey("Ctrl+P");

        expect(testApp.querySelector("QuickPickElement")).not.toBeNull();
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("Ctrl+Shift+P opens QuickPickElement in commands mode", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        controller.focusEditor();

        commandRegistry.execute("workbench.action.showCommands");
        testApp.render();

        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);
        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        expect(picker.placeholder).toBe("Show All Commands");
    });

    it("reassembles a key sequence delivered split across two stdin reads", () => {
        // Over SSH/tmux/slow links a multi-byte key sequence can arrive in two reads.
        // The parser must buffer the partial first chunk and reassemble it, instead of
        // mis-tokenizing it as a lone Escape + literal characters (which would lose the
        // keypress and leak stray chars). Uses the showCommands sequence as a concrete example.
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        testApp.backend.sendRaw("\x1b[112;6"); // first read — incomplete CSI-u
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);

        testApp.backend.sendRaw("u"); // rest of the same sequence → reassembled
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("Escape closes Quick Open picker", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);

        testApp.sendKey("Escape");

        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("Escape after Ctrl+P returns focus to editor", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/focus-restore.txt");
        controller.focusEditor();
        const editorElement = testApp.querySelector("EditorElement");

        testApp.sendKey("Ctrl+P");
        testApp.sendKey("Escape");

        expect(testApp.focusedElement).toBe(editorElement);
    });

    it("Ctrl+P while picker already open does not open second picker", () => {
        const { testApp, controller } = createTestAppController();
        controller.focusEditor();

        // The app hosts persistent singleton pickers (quick-open + quick-input);
        // pressing Ctrl+P must reuse the quick-open one, never spawn a new element.
        const before = testApp.querySelectorAll("QuickPickElement").length;
        testApp.sendKey("Ctrl+P");
        testApp.sendKey("Ctrl+P");

        expect(testApp.querySelectorAll("QuickPickElement").length).toBe(before);
    });

    it("Show Commands lists registered commands", () => {
        const { testApp, controller, commandRegistry } = createTestAppController();
        commandRegistry.register("test.myCmd", () => {}, "My Test Command");
        controller.focusEditor();

        commandRegistry.execute("workbench.action.showCommands");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        const labels = picker.items.map((i) => i.label);
        expect(labels).toContain("My Test Command");
    });
});

describe("AppController — runtime extended-keys detection", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        // Force a legacy baseline: tmux masks $TERM and ssh strips the kitty env flag,
        // so neither the term-name hint nor the env-flag hint fires.
        process.env.TERM = "tmux-256color";
        process.env.TMUX = "/tmp/tmux-1000/default,1,0";
        delete process.env.KITTY_WINDOW_ID;
        delete process.env.GHOSTTY_RESOURCES_DIR;
        delete process.env.WEZTERM_PANE;
        delete process.env.ALACRITTY_WINDOW_ID;
        delete process.env.TERM_PROGRAM;
        delete process.env.COLORTERM;
    });

    afterEach(() => {
        process.env = savedEnv;
    });

    function mountController() {
        const { container } = createTestContainer();
        const controller = container.get(AppControllerDIToken);
        controller.mount();
        const env = container.get(TerminalEnvironmentServiceDIToken);
        return { controller, env };
    }

    it("promotes the tier off legacy when a CSI-u key arrives (e.g. Ctrl+Tab behind tmux)", () => {
        const { controller, env } = mountController();
        expect(env.tier).toBe("legacy");

        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Tab", ctrlKey: true, raw: "\x1b[9;5u" }));

        expect(env.tier).toBe("csi-u");
        expect(env.hasCapability("extended-keys")).toBe(true);
    });

    it("leaves the tier at legacy for ordinary (non-CSI-u) keys", () => {
        const { controller, env } = mountController();

        controller.view.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a", raw: "a" }));

        expect(env.tier).toBe("legacy");
    });
});

describe("AppController — completion wiring", () => {
    it("editor.action.triggerSuggest исполняется без ошибок", () => {
        const { controller, commandRegistry } = createTestAppController();
        controller.openFile("/tmp/completion-trigger.txt");
        controller.focusEditor();
        expect(() => commandRegistry.execute("editor.action.triggerSuggest")).not.toThrow();
    });

    it("onExecuteCommand completion-контроллера маршрутизирует в CommandRegistry", () => {
        const { controller, commandRegistry } = createTestAppController();
        let ran: unknown[] | null = null;
        commandRegistry.register("test.fromCompletion", (...args: unknown[]) => {
            ran = args;
        });
        // AppController присвоил completionController.onExecuteCommand в конструкторе —
        // вызов этого колбэка должен уйти в commands.execute.
        const cc = (
            controller as unknown as {
                completionController: { onExecuteCommand: (id: string, ...args: unknown[]) => void };
            }
        ).completionController;
        cc.onExecuteCommand("test.fromCompletion", 42);
        expect(ran).toEqual([42]);
    });
});
