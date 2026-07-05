import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

// End-to-end keyboard navigation in the file tree (issue #33): keys travel the real
// path — raw escape sequence → parser → keybinding dispatch → list.* command.

const FILE_COUNT = 40;

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-tree-nav-"));
    for (let i = 0; i < FILE_COUNT; i++) {
        fs.writeFileSync(path.join(dir, `file-${String(i).padStart(2, "0")}.txt`), `content ${String(i)}`);
    }
    return dir;
}

describe("FileTree keyboard navigation — PgUp/PgDown, Home/End", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let tree: TreeViewElement<unknown>;

    beforeEach(async () => {
        tmpDir = createTempWorkspace();
        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        await controller.activate();
        testApp.render();
        tree = testApp.querySelector("TreeViewElement") as unknown as TreeViewElement<unknown>;
        tree.focus();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function selectedIndex(): number {
        return (tree as unknown as { selectedIndex: number }).selectedIndex;
    }

    it("PageDown moves selection down a page", () => {
        testApp.sendKey("PageDown");
        testApp.render();
        expect(selectedIndex()).toBeGreaterThan(0);
    });

    it("PageUp moves selection back up", () => {
        testApp.sendKey("PageDown");
        testApp.render();
        const after = selectedIndex();
        expect(after).toBeGreaterThan(0);

        testApp.sendKey("PageUp");
        testApp.render();
        expect(selectedIndex()).toBeLessThan(after);
    });

    it("End moves selection to the last item", () => {
        testApp.sendKey("End");
        testApp.render();
        expect(selectedIndex()).toBe(FILE_COUNT - 1);
    });

    it("Home moves selection back to the first item", () => {
        testApp.sendKey("End");
        testApp.render();
        expect(selectedIndex()).toBe(FILE_COUNT - 1);

        testApp.sendKey("Home");
        testApp.render();
        expect(selectedIndex()).toBe(0);
    });

    it("navigation keys still work in the tree while an editor is open", () => {
        testApp.sendKey("Enter"); // open selected file — focus moves to the editor
        testApp.render();
        tree.focus();
        testApp.render();

        testApp.sendKey("End");
        testApp.render();
        expect(selectedIndex()).toBe(FILE_COUNT - 1);

        testApp.sendKey("PageUp");
        testApp.render();
        expect(selectedIndex()).toBeLessThan(FILE_COUNT - 1);
    });

    it("kitty-encoded keys (explicit press event type) work too", () => {
        testApp.backend.sendRaw("\x1b[6;1:1~"); // PageDown, kitty event-type syntax
        testApp.render();
        expect(selectedIndex()).toBeGreaterThan(0);

        testApp.backend.sendRaw("\x1b[1;1:1~"); // Home
        testApp.render();
        expect(selectedIndex()).toBe(0);
    });
});
