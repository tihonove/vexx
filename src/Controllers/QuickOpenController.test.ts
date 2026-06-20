import { describe, expect, it, vi } from "vitest";

import { charMask } from "../Common/FuzzySearch.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";
import type { QuickPickItem } from "../TUIDom/Widgets/QuickPickElement.ts";

import { CommandRegistry } from "./CommandRegistry.ts";
import { ContextKeyService } from "./ContextKeyService.ts";
import type { FileSearchEntry, FileSearchResult, FileSearchService } from "./FileSearchService.ts";
import { KeybindingRegistry, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";
import { QuickOpenController } from "./QuickOpenController.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileEntry(relativePath: string, absolutePath = `/root/${relativePath}`): FileSearchEntry {
    const basename = relativePath.split("/").pop() ?? relativePath;
    const basenameLower = basename.toLowerCase();
    const relativePathLower = relativePath.toLowerCase();
    return {
        relativePath,
        absolutePath,
        basename,
        basenameLower,
        relativePathLower,
        basenameBits: charMask(basenameLower),
        relativePathBits: charMask(relativePathLower),
    };
}

function makeSearchResult(relativePath: string, matchedIndices: number[] = []): FileSearchResult {
    return { entry: makeFileEntry(relativePath), score: 100, matchedIndices };
}

function makeFileSearchStub(results: FileSearchResult[] = []): FileSearchService {
    return {
        search: vi.fn(() => results),
        activate: vi.fn(),
        refreshIfStale: vi.fn(),
        isIndexed: true,
        onIndexChanged: null,
        dispose: vi.fn(),
        register: vi.fn(),
    } as unknown as FileSearchService;
}

function createController(fileResults: FileSearchResult[] = []): {
    controller: QuickOpenController;
    commands: CommandRegistry;
    keybindings: KeybindingRegistry;
    contextKeys: ContextKeyService;
    body: BodyElement;
    testApp: TestApp;
    fileSearch: FileSearchService;
} {
    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const contextKeys = new ContextKeyService();
    const fileSearch = makeFileSearchStub(fileResults);
    const controller = new QuickOpenController(fileSearch, commands, keybindings, contextKeys);

    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);

    return { controller, commands, keybindings, contextKeys, body, testApp, fileSearch };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("QuickOpenController — open/close", () => {
    it("picker is hidden by default", () => {
        const { body } = createController();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("open() makes picker visible", () => {
        const { controller, body } = createController();
        controller.open("files");
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("close() hides picker", () => {
        const { controller, body } = createController();
        controller.open("files");
        controller.close();
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("open() sets focus to QuickPickElement", () => {
        const { controller, testApp } = createController();
        controller.open("files");
        expect(testApp.focusedElement?.constructor.name).toBe("InputElement");
    });

    it("open() when already open calls focus instead of re-opening", () => {
        const { controller, body } = createController();
        controller.open("files");
        const setVisibleSpy = vi.spyOn(body.overlayLayer, "setVisible");
        controller.open("files");
        // setVisible should not be called again (already visible, just focuses)
        expect(setVisibleSpy).not.toHaveBeenCalled();
    });

    it("Escape key closes picker", () => {
        const { controller, body, testApp } = createController();
        controller.open("files");
        testApp.sendKey("Escape");
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("close() on a never-opened picker is a no-op", () => {
        const { controller, fileSearch } = createController();
        // Subscribe a marker so we can prove close() short-circuits before touching it.
        fileSearch.onIndexChanged = () => undefined;
        controller.close();
        // Early return: the index subscription is left untouched.
        expect(fileSearch.onIndexChanged).not.toBeNull();
    });

    it("close() restores focus to previously focused element", () => {
        const { controller, testApp, body } = createController();
        // Put something focusable in the body and focus it first
        const dummyInput = new InputElement();
        dummyInput.tabIndex = 0;
        body.setContent(dummyInput);
        testApp.app.root = body;
        dummyInput.focus();
        const prevFocused = testApp.focusedElement;

        controller.open("files");
        controller.close();

        expect(testApp.focusedElement).toBe(prevFocused);
    });
});

describe("QuickOpenController — files mode", () => {
    it("open('files') sets empty placeholder", () => {
        const { controller } = createController();
        controller.open("files");
        expect(controller.view.placeholder).toBe("Go to File...");
    });

    it("open('files') calls search with empty query", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        expect(fileSearch.search).toHaveBeenCalledWith("", 50);
    });

    it("open('files') kicks a throttled background re-index", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        expect(fileSearch.refreshIfStale).toHaveBeenCalled();
    });

    it("index growing while open re-runs the current query", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        controller.view.setQuery("App");
        (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

        // Simulate the background walk publishing more entries.
        fileSearch.onIndexChanged?.();

        expect(fileSearch.search).toHaveBeenCalledWith("App", 50);
    });

    it("a late index-changed callback after close does not re-run the search", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        // Capture the index-changed handler the controller installed.
        const handler = fileSearch.onIndexChanged;
        expect(handler).not.toBeNull();

        controller.close();
        (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

        // Fire the captured callback after the session is closed: handleIndexChanged
        // must bail out (session not open) and not query the index.
        handler?.();
        expect(fileSearch.search).not.toHaveBeenCalled();
    });

    it("switching to command mode stops live file refreshes", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        controller.view.onQueryChange?.(">cmd"); // now in command mode
        (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

        fileSearch.onIndexChanged?.();

        expect(fileSearch.search).not.toHaveBeenCalled();
    });

    it("close() unsubscribes from index changes", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        expect(fileSearch.onIndexChanged).not.toBeNull();
        controller.close();
        expect(fileSearch.onIndexChanged).toBeNull();
    });

    it("items show basename as label and directory as description", () => {
        const results = [makeSearchResult("src/Controllers/AppController.ts")];
        const { controller } = createController(results);
        controller.open("files");
        const items = controller.view.items;
        expect(items[0].label).toBe("AppController.ts");
        expect(items[0].description).toBe("src/Controllers");
    });

    it("file in root directory has empty description", () => {
        const results = [makeSearchResult("README.md")];
        const { controller } = createController(results);
        controller.open("files");
        expect(controller.view.items[0].description).toBe("");
    });

    it("typing triggers search with new query", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        controller.view.onQueryChange?.("App");
        expect(fileSearch.search).toHaveBeenCalledWith("App", 50);
    });

    it("match indices map to label highlight ranges", () => {
        // relativePath = "src/App.ts", basename = "App.ts" (offset=4)
        // indices [4, 5, 6] → basename indices [0, 1, 2] → one range [0, 3]
        const results: FileSearchResult[] = [
            {
                entry: makeFileEntry("src/App.ts"),
                score: 100,
                matchedIndices: [4, 5, 6],
            },
        ];
        const { controller } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        expect(item.labelMatchRanges).toEqual([[0, 3]]);
    });

    it("match indices in the directory portion map to description highlight ranges", () => {
        // relativePath = "src/App.ts", basename = "App.ts" (basenameOffset=4).
        // indices [0,1,2] are all < 4 → directory ("src") → merged range [0,3].
        const results: FileSearchResult[] = [
            {
                entry: makeFileEntry("src/App.ts"),
                score: 100,
                matchedIndices: [0, 1, 2],
            },
        ];
        const { controller } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        expect(item.descriptionMatchRanges).toEqual([[0, 3]]);
        // Nothing matched inside the basename.
        expect(item.labelMatchRanges).toEqual([]);
    });

    it("non-adjacent directory matches produce separate description ranges", () => {
        // relativePath = "src/App.ts" → directory chars at offsets 0..2 ("src").
        // indices [0, 2] are non-adjacent → two separate ranges.
        const results: FileSearchResult[] = [
            {
                entry: makeFileEntry("src/App.ts"),
                score: 100,
                matchedIndices: [0, 2],
            },
        ];
        const { controller } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        expect(item.descriptionMatchRanges).toEqual([
            [0, 1],
            [2, 3],
        ]);
    });

    it("matches spanning directory and basename split into both range sets", () => {
        // relativePath = "src/App.ts" (length 10), basename "App.ts" offset=4.
        // indices [2,3] → directory range [2,3]; indices [4,5] → label range [0,2].
        const results: FileSearchResult[] = [
            {
                entry: makeFileEntry("src/App.ts"),
                score: 100,
                matchedIndices: [2, 3, 4, 5],
            },
        ];
        const { controller } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        expect(item.descriptionMatchRanges).toEqual([[2, 4]]);
        expect(item.labelMatchRanges).toEqual([[0, 2]]);
    });

    it("onAccept calls onExecuteCommand with workbench.openFile and absolutePath", async () => {
        const results = [makeSearchResult("src/main.ts", [])];
        const { controller } = createController(results);
        const execSpy = vi.fn();
        controller.onExecuteCommand = execSpy;
        controller.open("files");

        const item = controller.view.items[0] as QuickPickItem & { absolutePath: string };
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => {
            queueMicrotask(r);
        });

        expect(execSpy).toHaveBeenCalledWith("workbench.openFile", "/root/src/main.ts");
    });

    it("accepting an item with neither commandId nor path does nothing", async () => {
        const { controller, body } = createController();
        const execSpy = vi.fn();
        controller.onExecuteCommand = execSpy;
        controller.open("files");

        // A bare item carrying no routing metadata (no commandId, no absolutePath).
        const bareItem: QuickPickItem = { label: "orphan" };
        controller.view.onAccept?.(bareItem, 0);
        await new Promise<void>((r) => {
            queueMicrotask(r);
        });

        // Neither branch fires: no command executed, picker stays open.
        expect(execSpy).not.toHaveBeenCalled();
        expect(body.overlayLayer.hasVisibleItems()).toBe(true);
    });

    it("accepting file closes the picker", async () => {
        const results = [makeSearchResult("src/main.ts")];
        const { controller, body } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => {
            queueMicrotask(r);
        });
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });
});

describe("QuickOpenController — commands mode", () => {
    it("open('commands') sets placeholder", () => {
        const { controller } = createController();
        controller.open("commands");
        expect(controller.view.placeholder).toBe("Show All Commands");
    });

    it("open('commands') sets '>' query", () => {
        const { controller } = createController();
        controller.open("commands");
        expect(controller.view.getQuery()).toBe(">");
    });

    it("lists registered commands with titles", () => {
        const { controller, commands } = createController();
        commands.register("cmd.a", () => {}, "Command A");
        commands.register("cmd.b", () => {}, "Command B");
        controller.open("commands");
        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toContain("Command A");
        expect(labels).toContain("Command B");
    });

    it("commands without title are not listed", () => {
        const { controller, commands } = createController();
        commands.register("cmd.hidden", () => {});
        commands.register("cmd.visible", () => {}, "Visible");
        controller.open("commands");
        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toContain("Visible");
        expect(labels).not.toContain("cmd.hidden");
    });

    it("shows the keybinding shortcut for a command", () => {
        const { controller, commands, keybindings } = createController();
        commands.register("cmd.save", () => {}, "File: Save");
        keybindings.register(parseKeybinding("ctrl+s"), "cmd.save");
        controller.open("commands");
        const item = controller.view.items.find((i) => i.label === "File: Save");
        expect(item?.shortcut).toBe("Ctrl+S");
    });

    it("renders chord bindings as a space-separated sequence", () => {
        const { controller, commands, keybindings } = createController();
        commands.register("cmd.save", () => {}, "File: Save");
        keybindings.register(parseChord("ctrl+k s"), "cmd.save");
        controller.open("commands");
        const item = controller.view.items.find((i) => i.label === "File: Save");
        expect(item?.shortcut).toBe("Ctrl+K S");
    });

    it("shows no shortcut when the command has no binding", () => {
        const { controller, commands } = createController();
        commands.register("cmd.x", () => {}, "Do X");
        controller.open("commands");
        const item = controller.view.items.find((i) => i.label === "Do X");
        expect(item?.shortcut).toBeUndefined();
    });

    it("with multiple bindings shows the first registered", () => {
        const { controller, commands, keybindings } = createController();
        commands.register("cmd.save", () => {}, "File: Save");
        keybindings.register(parseKeybinding("ctrl+s"), "cmd.save");
        keybindings.register(parseChord("ctrl+k s"), "cmd.save");
        controller.open("commands");
        const item = controller.view.items.find((i) => i.label === "File: Save");
        expect(item?.shortcut).toBe("Ctrl+S");
    });

    it("with when-conditioned bindings shows the one matching the current context", () => {
        const { controller, commands, keybindings, contextKeys } = createController();
        commands.register("cmd.go", () => {}, "Go");
        keybindings.register(parseKeybinding("ctrl+s"), "cmd.go", "textInputFocus");
        keybindings.register(parseKeybinding("ctrl+l"), "cmd.go", "listFocus");
        contextKeys.set("listFocus", true);
        controller.open("commands");
        const item = controller.view.items.find((i) => i.label === "Go");
        expect(item?.shortcut).toBe("Ctrl+L");
    });

    it("typing after '>' filters commands by title (case-insensitive)", () => {
        const { controller, commands } = createController();
        commands.register("cmd.save", () => {}, "File: Save");
        commands.register("cmd.open", () => {}, "File: Open");
        commands.register("cmd.quit", () => {}, "Quit");
        controller.open("commands");
        controller.view.onQueryChange?.(">save");
        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toContain("File: Save");
        expect(labels).not.toContain("File: Open");
        expect(labels).not.toContain("Quit");
    });

    it("onAccept fires onExecuteCommand with commandId", async () => {
        const { controller, commands } = createController();
        commands.register("cmd.x", () => {}, "Do X");
        const execSpy = vi.fn();
        controller.onExecuteCommand = execSpy;
        controller.open("commands");
        const item = controller.view.items[0];
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => {
            queueMicrotask(r);
        });
        expect(execSpy).toHaveBeenCalledWith("cmd.x");
    });

    it("accepting command closes the picker", async () => {
        const { controller, commands, body } = createController();
        commands.register("cmd.x", () => {}, "Do X");
        controller.open("commands");
        const item = controller.view.items[0];
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => {
            queueMicrotask(r);
        });
        expect(body.overlayLayer.hasVisibleItems()).toBe(false);
    });
});

describe("QuickOpenController — mode switching via '>'", () => {
    it("typing '>' in file mode switches to command items", () => {
        const { controller, commands } = createController();
        commands.register("cmd.a", () => {}, "Command A");
        controller.open("files");
        controller.view.onQueryChange?.(">Command");
        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toContain("Command A");
    });

    it("removing '>' switches back to file results", () => {
        const results = [makeSearchResult("src/main.ts")];
        const { controller } = createController(results);
        controller.open("files");
        controller.view.onQueryChange?.(">foo");
        controller.view.onQueryChange?.("main");
        const labels = controller.view.items.map((i) => i.label);
        expect(labels).toContain("main.ts");
    });
});

describe("QuickOpenController — position and size", () => {
    it("open() sets preferredWidth to computed pickerW", () => {
        // 80-wide screen: pickerW = min(80, max(40, 80-4)) = 76
        const { controller } = createController();
        controller.open("files");
        expect(controller.view.preferredWidth).toBe(76);
    });

    it("open() sets smaller pickerW on narrow screen", () => {
        const commands = new CommandRegistry();
        const fileSearch = makeFileSearchStub();
        const ctrl = new QuickOpenController(fileSearch, commands, new KeybindingRegistry(), new ContextKeyService());
        const body = new BodyElement();
        const testApp = TestApp.create(body, new Size(50, 24));
        ctrl.setHostView(body);

        ctrl.open("files");
        // pickerW = min(80, max(40, 50-4)) = min(80, 46) = 46
        expect(ctrl.view.preferredWidth).toBe(46);
        testApp.render();
        expect(ctrl.view.layoutSize.width).toBe(46);
    });

    it("open() without a host view is a no-op for positioning", () => {
        // No setHostView() → hostBody is null and there is no overlay session.
        const commands = new CommandRegistry();
        const fileSearch = makeFileSearchStub();
        const ctrl = new QuickOpenController(fileSearch, commands, new KeybindingRegistry(), new ContextKeyService());

        // open() reaches updatePosition, which must early-return without throwing
        // because there is no host body to measure against.
        expect(() => {
            ctrl.open("files");
        }).not.toThrow();
        // preferredWidth keeps its default since positioning was skipped (no recompute).
        expect(ctrl.view.preferredWidth).toBe(60);
    });

    it("picker is horizontally centred after layout", () => {
        const { controller, testApp } = createController();
        controller.open("files");
        testApp.render();
        // pickerW=76, screen=80: px = floor((80-76)/2) = 2
        expect(controller.view.globalPosition.x).toBe(2);
    });

    it("picker width after layout matches preferredWidth", () => {
        const { controller, testApp } = createController();
        controller.open("files");
        testApp.render();
        expect(controller.view.layoutSize.width).toBe(controller.view.preferredWidth);
    });
});

describe("QuickOpenController — file-search debounce", () => {
    it("first keystroke after idle runs search synchronously (leading edge)", () => {
        const { controller, fileSearch } = createController();
        controller.open("files");
        (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

        controller.view.onQueryChange?.("App");

        expect(fileSearch.search).toHaveBeenCalledTimes(1);
        expect(fileSearch.search).toHaveBeenLastCalledWith("App", 50);
    });

    it("a burst of keystrokes coalesces into one leading + one trailing run", () => {
        vi.useFakeTimers();
        try {
            const { controller, fileSearch } = createController();
            controller.open("files");
            (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

            controller.view.onQueryChange?.("A"); // leading → runs now
            controller.view.onQueryChange?.("Ap"); // within cooldown → pending
            controller.view.onQueryChange?.("App"); // within cooldown → replaces pending

            // Only the leading run has happened so far.
            expect(fileSearch.search).toHaveBeenCalledTimes(1);
            expect(fileSearch.search).toHaveBeenLastCalledWith("A", 50);

            vi.runAllTimers(); // trailing fires with the latest query

            expect(fileSearch.search).toHaveBeenCalledTimes(2);
            expect(fileSearch.search).toHaveBeenLastCalledWith("App", 50);
        } finally {
            vi.useRealTimers();
        }
    });

    it("no trailing run when nothing changed during the cooldown", () => {
        vi.useFakeTimers();
        try {
            const { controller, fileSearch } = createController();
            controller.open("files");
            (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

            controller.view.onQueryChange?.("App"); // leading only
            vi.runAllTimers();

            expect(fileSearch.search).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("closing cancels a pending trailing run", () => {
        vi.useFakeTimers();
        try {
            const { controller, fileSearch } = createController();
            controller.open("files");
            (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

            controller.view.onQueryChange?.("A"); // leading
            controller.view.onQueryChange?.("Ap"); // pending
            controller.close();

            vi.runAllTimers();

            // Only the leading run; the trailing one was cancelled on close.
            expect(fileSearch.search).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("switching to command mode runs synchronously and drops a pending file search", () => {
        vi.useFakeTimers();
        try {
            const { controller, fileSearch } = createController();
            controller.open("files");
            (fileSearch.search as ReturnType<typeof vi.fn>).mockClear();

            controller.view.onQueryChange?.("A"); // file leading
            controller.view.onQueryChange?.("Ap"); // file pending
            controller.view.onQueryChange?.(">cmd"); // command mode → sync, cancels pending

            vi.runAllTimers();

            // The pending file trailing run was dropped; only the leading file run ran.
            expect(fileSearch.search).toHaveBeenCalledTimes(1);
            expect(fileSearch.search).toHaveBeenLastCalledWith("A", 50);
        } finally {
            vi.useRealTimers();
        }
    });
});
