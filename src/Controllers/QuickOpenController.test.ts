import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { QuickPickItem } from "../TUIDom/Widgets/QuickPickElement.ts";

import { CommandRegistry } from "./CommandRegistry.ts";
import type { FileSearchEntry, FileSearchResult, FileSearchService } from "./FileSearchService.ts";
import { QuickOpenController } from "./QuickOpenController.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileEntry(relativePath: string, absolutePath = `/root/${relativePath}`): FileSearchEntry {
    return { relativePath, absolutePath };
}

function makeSearchResult(relativePath: string, matchedIndices: number[] = []): FileSearchResult {
    return { entry: makeFileEntry(relativePath), score: 100, matchedIndices };
}

function makeFileSearchStub(results: FileSearchResult[] = []): FileSearchService {
    return {
        search: vi.fn(() => results),
        activate: vi.fn(),
        isIndexed: true,
        onIndexChanged: null,
        dispose: vi.fn(),
        register: vi.fn(),
    } as unknown as FileSearchService;
}

function createController(fileResults: FileSearchResult[] = []): {
    controller: QuickOpenController;
    commands: CommandRegistry;
    body: BodyElement;
    testApp: TestApp;
    fileSearch: FileSearchService;
} {
    const commands = new CommandRegistry();
    const fileSearch = makeFileSearchStub(fileResults);
    const controller = new QuickOpenController(fileSearch, commands);

    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    controller.setHostView(body);

    return { controller, commands, body, testApp, fileSearch };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("QuickOpenController — open/close", () => {
    it("picker is hidden by default", () => {
        const { body } = createController();
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(false);
    });

    it("open() makes picker visible", () => {
        const { controller, body } = createController();
        controller.open("files");
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(true);
    });

    it("close() hides picker", () => {
        const { controller, body } = createController();
        controller.open("files");
        controller.close();
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(false);
    });

    it("open() sets focus to QuickPickElement", () => {
        const { controller, testApp } = createController();
        controller.open("files");
        expect(testApp.focusedElement?.constructor.name).toBe("InputElement");
    });

    it("open() when already open calls focus instead of re-opening", () => {
        const { controller, body } = createController();
        controller.open("files");
        const setVisibleSpy = vi.spyOn(body.contextMenuLayer, "setVisible");
        controller.open("files");
        // setVisible should not be called again (already visible, just focuses)
        expect(setVisibleSpy).not.toHaveBeenCalled();
    });

    it("Escape key closes picker", () => {
        const { controller, body, testApp } = createController();
        controller.open("files");
        testApp.sendKey("Escape");
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(false);
    });

    it("close() restores focus to previously focused element", () => {
        const { controller, testApp, body } = createController();
        // Put something focusable in the body and focus it first
        const dummyInput = new (require("../TUIDom/Widgets/InputElement.ts").InputElement)();
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
        const results: FileSearchResult[] = [{
            entry: makeFileEntry("src/App.ts"),
            score: 100,
            matchedIndices: [4, 5, 6],
        }];
        const { controller } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        expect(item.labelMatchRanges).toEqual([[0, 3]]);
    });

    it("onAccept calls onExecuteCommand with workbench.openFile and absolutePath", async () => {
        const results = [makeSearchResult("src/main.ts", [])];
        const { controller } = createController(results);
        const execSpy = vi.fn();
        controller.onExecuteCommand = execSpy;
        controller.open("files");

        const item = controller.view.items[0] as QuickPickItem & { absolutePath: string };
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => queueMicrotask(r));

        expect(execSpy).toHaveBeenCalledWith("workbench.openFile", "/root/src/main.ts");
    });

    it("accepting file closes the picker", async () => {
        const results = [makeSearchResult("src/main.ts")];
        const { controller, body } = createController(results);
        controller.open("files");
        const item = controller.view.items[0];
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => queueMicrotask(r));
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(false);
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
        await new Promise<void>((r) => queueMicrotask(r));
        expect(execSpy).toHaveBeenCalledWith("cmd.x");
    });

    it("accepting command closes the picker", async () => {
        const { controller, commands, body } = createController();
        commands.register("cmd.x", () => {}, "Do X");
        controller.open("commands");
        const item = controller.view.items[0];
        controller.view.onAccept?.(item, 0);
        await new Promise<void>((r) => queueMicrotask(r));
        expect(body.contextMenuLayer.hasVisibleItems()).toBe(false);
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
